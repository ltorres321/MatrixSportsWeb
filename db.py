# ==================================================================
# DB — small psycopg2 connection helper.
#
# Reads DATABASE_URL from this project's own .env (gitignored, never
# hardcoded). SportsWeb only ever SELECTs against predictions/
# latest_predictions -- the SportsAnalytics project (a separate repo)
# owns every INSERT into those; see its sql/001_predictions_schema.sql
# for that schema.
#
# subscribers is different: it's a table SportsWeb itself created (see
# sql/001_subscribers_schema.sql) and is the only writer of, so writes
# there are fine -- see insert_subscriber below.
#
# Each request opens its own short-lived connection rather than the
# app holding one open for its whole lifetime -- simple, and plenty
# fast at this project's traffic/data volume. A connection pool is a
# reasonable next step if this ever needs real concurrent load, not
# before.
# ==================================================================

import os
from pathlib import Path

from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env")


def get_connection():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not set -- check .env")
    return psycopg2.connect(database_url, connect_timeout=10)


def fetch_all(query, params=None):
    """Run a read-only query and return every row as a list of dicts."""

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params or ())
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def insert_subscriber(fields):
    """Insert one row into subscribers, returning its new id.

    Raises psycopg2.errors.UniqueViolation if the email is already
    registered -- main.py turns that into a 409 rather than a 500."""

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO subscribers
                    (first_name, middle_name, last_name, email, cell,
                     address, city, state, zip, favorite_team, notify_win_prob)
                VALUES (%(first_name)s, %(middle_name)s, %(last_name)s,
                        %(email)s, %(cell)s, %(address)s, %(city)s, %(state)s,
                        %(zip)s, %(favorite_team)s, %(notify_win_prob)s)
                RETURNING id;
                """,
                fields,
            )
            new_id = cur.fetchone()[0]
        conn.commit()
        return new_id
    finally:
        conn.close()
