# ==================================================================
# DB — small psycopg2 connection helper.
#
# Reads DATABASE_URL from this project's own .env (gitignored, never
# hardcoded). SportsWeb only ever SELECTs from Postgres -- the
# SportsAnalytics project (a separate repo) owns every INSERT into
# predictions; see its sql/001_predictions_schema.sql for the schema
# this project reads against.
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
