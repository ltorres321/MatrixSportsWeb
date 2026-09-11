import "server-only";
import { TEAMS } from "@/lib/teams";

// Live in-game status/score, sourced from ESPN's public scoreboard --
// a different source than schedule.ts (TheSportsDB), which gives the
// full multi-week schedule but isn't meant to be polled every 30
// seconds for a score that's currently changing. ESPN's scoreboard
// endpoint always returns "the current week" with no way to ask for
// a different one -- which is fine here, since live status is never
// meaningful for any week except whichever one is happening right
// now anyway.

const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const CACHE_TTL_MS = 30 * 1000; // 30s -- short enough to feel live without hammering ESPN on every page view

// Same name-based resolution schedule.ts already uses for TheSportsDB
// (ESPN's own abbreviations don't always match ours -- e.g. "WSH" vs
// this project's "WAS" -- so full display name is the reliable join,
// not the short code).
const NAME_TO_ALIAS = new Map(TEAMS.map((t) => [`${t.market} ${t.name}`, t.alias]));

export type LiveStatus = "pre" | "in" | "post";

export interface LiveScore {
  status: LiveStatus;
  home_score: number;
  away_score: number;
  // e.g. "Q2 8:28", "Halftime", "Final" -- built from period/clock
  // ourselves rather than parsed from ESPN's own shortDetail string,
  // which isn't a contract we can rely on staying formatted the same.
  status_detail: string;
}

interface EspnTeam {
  displayName?: string;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team?: EspnTeam;
}

interface EspnStatusType {
  state?: string;
}

interface EspnStatus {
  type?: EspnStatusType;
  period?: number;
  displayClock?: string;
}

interface EspnCompetition {
  competitors?: EspnCompetitor[];
  status?: EspnStatus;
}

interface EspnEvent {
  competitions?: EspnCompetition[];
}

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

let cache: { expires: number; byGameId: Map<string, LiveScore> } | null = null;

function buildStatusDetail(state: LiveStatus, period: number, displayClock: string): string {
  if (state === "post") return "Final";
  if (state === "pre") return "";
  if (period <= 0) return "Live";
  const half = period > 4 ? "OT" : `Q${period}`;
  return displayClock === "0:00" ? `End of ${half}` : `${half} ${displayClock}`;
}

async function fetchLiveScores(): Promise<Map<string, LiveScore>> {
  if (cache && cache.expires > Date.now()) return cache.byGameId;

  const byGameId = new Map<string, LiveScore>();

  try {
    const res = await fetch(ESPN_SCOREBOARD_URL, { next: { revalidate: 30 } });
    if (res.ok) {
      const data = (await res.json()) as EspnScoreboardResponse;

      for (const event of data.events ?? []) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const home = competition.competitors?.find((c) => c.homeAway === "home");
        const away = competition.competitors?.find((c) => c.homeAway === "away");
        if (!home?.team?.displayName || !away?.team?.displayName) continue;

        const homeAlias = NAME_TO_ALIAS.get(home.team.displayName);
        const awayAlias = NAME_TO_ALIAS.get(away.team.displayName);
        if (!homeAlias || !awayAlias) continue;

        const rawState = competition.status?.type?.state;
        const state: LiveStatus = rawState === "in" ? "in" : rawState === "post" ? "post" : "pre";
        const period = competition.status?.period ?? 0;
        const displayClock = competition.status?.displayClock ?? "0:00";

        // Keyed the same way schedule.ts builds universal_game_id, so
        // callers that already have a game's id (from a prediction
        // row or the schedule) can look this up directly -- season is
        // deliberately left out of the key computation here since
        // ESPN's scoreboard is always "the current week" anyway; the
        // caller only ever looks this up for that same week.
        byGameId.set(`${awayAlias}@${homeAlias}`, {
          status: state,
          home_score: Number(home.score ?? 0),
          away_score: Number(away.score ?? 0),
          status_detail: buildStatusDetail(state, period, displayClock),
        });
      }
    }
  } catch {
    // ESPN hiccup -- callers fall back to their own data (prediction
    // or schedule), never crash the page over a live-score fetch failing.
  }

  cache = { expires: Date.now() + CACHE_TTL_MS, byGameId };
  return byGameId;
}

export async function getLiveScore(awayTeam: string, homeTeam: string): Promise<LiveScore | null> {
  const scores = await fetchLiveScores();
  return scores.get(`${awayTeam}@${homeTeam}`) ?? null;
}

export async function getAllLiveScores(): Promise<Map<string, LiveScore>> {
  return fetchLiveScores();
}
