# ==================================================================
# MAIN — minimal FastAPI publishing layer for Matrix Sports Analytics.
#
# This is a SEPARATE project from SportsAnalytics on purpose: this
# app only ever talks to Postgres (the predictions table + latest_
# predictions view SportsAnalytics's File 58 writes into) -- it never
# touches pyspark, parquet files, or anything else in that pipeline.
# That's a clean enough boundary that keeping it in its own repo, with
# its own dependencies and its own deploy lifecycle, made more sense
# than nesting it inside the ML project. The only shared contract
# between the two is the database schema
# (SportsAnalytics/sql/001_predictions_schema.sql) and a DATABASE_URL
# pointing at the same database.
#
# No build step, no frontend framework. Three read-only endpoints
# against the shared predictions data, plus one write endpoint
# (/subscribe) against a subscribers table this project owns outright
# -- see db.py's header and sql/001_subscribers_schema.sql.
#
# OUT OF SCOPE for now: authentication/user accounts (subscribe just
# captures a lead -- there's no login, session, or password anywhere),
# real hosting/domain/TLS, a production process manager
# (gunicorn/systemd), CORS hardening beyond a permissive dev default,
# containerization, real frontend design.
#
# Run locally with:
#   .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# then open http://<this-machine's-LAN-IP>:8000/ from any device on
# the same network.
# ==================================================================

import re
from pathlib import Path
from typing import Optional

import psycopg2.errors
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator, model_validator

from db import fetch_all, insert_subscriber

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# Keep in sync with static/teams.js -- the favorite-team dropdown on
# the signup form.
TEAM_ALIASES = {
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN",
    "DET", "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA",
    "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB",
    "TEN", "WAS",
}


class SubscribeRequest(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    email: str
    cell: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    favorite_team: Optional[str] = None
    notify_win_prob: bool = False

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, value):
        if not value or not value.strip():
            raise ValueError("must not be blank")
        return value.strip()

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        value = value.strip().lower()
        if not EMAIL_RE.match(value):
            raise ValueError("must be a valid email address")
        return value

    @field_validator("favorite_team")
    @classmethod
    def valid_team(cls, value):
        if value in (None, ""):
            return None
        if value not in TEAM_ALIASES:
            raise ValueError(f"unknown team alias {value!r}")
        return value

    @field_validator("cell", "middle_name", "address", "city", "state", "zip")
    @classmethod
    def blank_to_none(cls, value):
        return value.strip() if value and value.strip() else None

    @model_validator(mode="after")
    def cell_required_for_notifications(self):
        if self.notify_win_prob and not self.cell:
            raise ValueError("cell is required when notify_win_prob is true")
        return self

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="Matrix Sports Analytics")

# Permissive dev default -- see module header. Tightening this to a
# real allowlist is explicitly out of scope for now.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/games/upcoming")
def upcoming_games():
    """Current week's games with each one's LATEST prediction --
    latest_predictions is a view, so this can never drift out of sync
    with the underlying append-only predictions table."""

    return fetch_all(
        "SELECT * FROM latest_predictions "
        "WHERE game_date >= now() "
        "ORDER BY game_date;"
    )


@app.get("/games/{universal_game_id}/predictions")
def game_prediction_history(universal_game_id: str):
    """Every prediction ever generated for one game, oldest first --
    how the line/probability moved before kickoff. predictions is
    append-only, so nothing here was ever overwritten."""

    rows = fetch_all(
        "SELECT * FROM predictions "
        "WHERE universal_game_id = %s "
        "ORDER BY generated_at;",
        (universal_game_id,),
    )
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No predictions found for {universal_game_id!r}",
        )
    return rows


@app.post("/subscribe", status_code=201)
def subscribe(payload: SubscribeRequest):
    """Create a free-account signup. See static/signup.js for the form
    that posts here -- validation there is a UX nicety, not the source
    of truth; everything is re-checked above via SubscribeRequest."""

    try:
        new_id = insert_subscriber(payload.model_dump())
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="An account with that email already exists.",
        )
    return {"id": new_id, "email": payload.email}


# Mounted last -- FastAPI matches routes in registration order, so the
# API routes above stay reachable even though this mount also claims
# "/".
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
