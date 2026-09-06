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
# Three endpoints, no auth, no build step, no frontend framework.
# Read-only against Postgres.
#
# OUT OF SCOPE for now: authentication/user accounts, real hosting/
# domain/TLS, a production process manager (gunicorn/systemd), CORS
# hardening beyond a permissive dev default, containerization, real
# frontend design.
#
# Run locally with:
#   .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# then open http://<this-machine's-LAN-IP>:8000/ from any device on
# the same network.
# ==================================================================

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db import fetch_all

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


# Mounted last -- FastAPI matches routes in registration order, so the
# API routes above stay reachable even though this mount also claims
# "/".
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
