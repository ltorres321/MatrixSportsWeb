import { Pool } from "pg";
import { teamByAlias } from "../../../src/lib/teams";

// Netlify Functions bundle independently from the Next.js app, so
// this deliberately does NOT import src/lib/db.ts -- that file is
// guarded by "server-only", a marker with defined behavior only under
// Next.js's own bundler, not a plain Node function runtime. A second
// small Pool here is a far smaller duplication than the 200+ lines of
// query/HTML-template logic this migration replaces (previously
// hand-duplicated in Python in a separate repo entirely).
let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL not set");
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return pool;
}

async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export const SITE_URL = "https://matrixsports.net";
const RESEND_FROM = "Matrix Sports Analytics <neo@matrixsports.net>";

// Email-client-safe palettes -- inline styles only, no external
// stylesheet, no box-shadow/glow (most clients strip it), matching
// the site's actual dark/light colors as closely as plain inline CSS
// reasonably allows.
export const THEMES = {
  dark: {
    bg: "#030603",
    panel: "#061a0c",
    border: "#134a22",
    text: "#c8ffd4",
    textDim: "#6fae83",
    accent: "#00ff41",
    accentText: "#04140a",
  },
  light: {
    bg: "#f4f8f5",
    panel: "#ffffff",
    border: "#d7e3da",
    text: "#12291a",
    textDim: "#4a6b55",
    accent: "#0969da",
    accentText: "#ffffff",
  },
} as const;

export type ThemeName = keyof typeof THEMES;

export function teamDisplay(alias: string): string {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

export function formatKickoff(gameDate: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }).format(gameDate) + " ET"
  );
}

// Same rule as web's getCurrentSeasonYear() (predictions.ts) -- NFL
// seasons span two calendar years, so "current" is this year from
// March on, still last year's season in Jan/Feb.
export function currentSeasonYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export interface CurrentWeek {
  season: number;
  week: number;
}

// Scoped to the current season first -- a backfill re-run on an
// older season touches generated_at on those rows too, which would
// otherwise look "more recent" than this week's actual predictions
// and point this digest at the wrong season entirely.
export async function currentSeasonWeek(): Promise<CurrentWeek | null> {
  const rows = await query<CurrentWeek>(
    "SELECT season, week FROM latest_predictions WHERE season = $1 ORDER BY generated_at DESC LIMIT 1",
    [currentSeasonYear()]
  );
  return rows[0] ?? null;
}

export interface SubscribedUser {
  id: string;
  notification_email: string;
  theme: string | null;
  notify_teams: string[];
}

export async function subscribedUsers(): Promise<SubscribedUser[]> {
  return query<SubscribedUser>(
    `SELECT id, notification_email, theme, notify_teams FROM profiles
     WHERE notify_win_prob = true AND cardinality(notify_teams) > 0
       AND notification_email IS NOT NULL`
  );
}

export interface GameRow {
  universal_game_id: string;
  home_team: string;
  away_team: string;
  game_date: Date;
  home_win_probability: number;
  market_spread_line_current: number;
}

export async function gamesForTeams(season: number, week: number, teams: string[]): Promise<GameRow[]> {
  return query<GameRow>(
    `SELECT universal_game_id, home_team, away_team, game_date,
            home_win_probability, market_spread_line_current
     FROM latest_predictions WHERE season = $1 AND week = $2
       AND (home_team = ANY($3) OR away_team = ANY($3))
     ORDER BY game_date ASC`,
    [season, week, teams]
  );
}

export async function alreadySentGameIds(profileId: string, emailType: string): Promise<Set<string>> {
  const rows = await query<{ universal_game_id: string }>(
    "SELECT universal_game_id FROM notification_sends WHERE profile_id = $1 AND email_type = $2",
    [profileId, emailType]
  );
  return new Set(rows.map((r) => r.universal_game_id));
}

// {universal_game_id: spread at Thursday's send} for this user --
// read back from notification_sends (the spread AS OF that send is
// recorded there) rather than re-derived from generated_at
// timestamps, which would be ambiguous if more than one prediction
// landed close to the actual send time.
export async function thursdayBaselineSpreads(profileId: string): Promise<Map<string, number>> {
  const rows = await query<{ universal_game_id: string; market_spread_line_current: number }>(
    `SELECT universal_game_id, market_spread_line_current FROM notification_sends
     WHERE profile_id = $1 AND email_type = 'thursday_digest'`,
    [profileId]
  );
  return new Map(rows.map((r) => [r.universal_game_id, r.market_spread_line_current]));
}

export async function recordSends(profileId: string, emailType: string, games: GameRow[]): Promise<void> {
  for (const g of games) {
    await query(
      `INSERT INTO notification_sends (profile_id, universal_game_id, email_type, market_spread_line_current)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (profile_id, universal_game_id, email_type) DO NOTHING`,
      [profileId, g.universal_game_id, emailType, g.market_spread_line_current]
    );
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  });

  if (!response.ok) {
    throw new Error(`Resend API error ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}
