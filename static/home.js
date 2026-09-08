// Look-and-feel prototype only. All matchup data below is hardcoded
// placeholder content -- it is not fetched from /games/upcoming and
// is not model output. See main.py's module header for what's
// actually live in this project.
//
// The free/locked gating on this page is a CLIENT-SIDE DEMO ONLY,
// driven by a localStorage flag (sw_member). There is no real
// authentication or backend account storage yet -- see signup.js.

const CURRENT_WEEK = 2;
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

// NFL seasons span two calendar years (kicks off in Sept, ends the
// following Feb) -- so "the current season" is this year until
// ~March, then last year until the new season kicks off. Computing it
// instead of hardcoding a year is what broke last time (this file
// said "2025" while it was actually 2026).
function getCurrentSeasonYear() {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

const CURRENT_SEASON_YEAR = getCurrentSeasonYear();

// Three seasons on purpose -- current season live, plus the last two
// completed seasons visible for transparency. See feedback memory on
// this project for why. Ids are relative (py1/py2 = "prior year 1/2")
// rather than baking in a literal year, so this doesn't go stale
// again next season.
const CURRENT_SEASON_MATCHUPS = [
  {
    id: "kc-buf",
    premier: true,
    status: "preview",
    kickoff: "Sun 1:00 PM ET",
    teamA: { alias: "BUF", record: "1-0", prob: 47 },
    teamB: { alias: "KC", record: "1-0", prob: 53 },
  },
  {
    id: "sf-dal",
    status: "preview",
    kickoff: "Sun 4:25 PM ET",
    teamA: { alias: "DAL", record: "0-1", prob: 38 },
    teamB: { alias: "SF", record: "1-0", prob: 62 },
  },
  {
    id: "phi-bal",
    status: "live",
    kickoff: "Q3 08:42",
    teamA: { alias: "BAL", record: "0-1", prob: 41, score: 17 },
    teamB: { alias: "PHI", record: "1-0", prob: 59, score: 24 },
  },
  {
    id: "det-gb",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "GB", record: "0-1", score: 20 },
    teamB: { alias: "DET", record: "2-0", score: 27, winner: true },
  },
  {
    id: "mia-nyj",
    status: "preview",
    kickoff: "Sun 1:00 PM ET",
    teamA: { alias: "NYJ", record: "0-1", prob: 44 },
    teamB: { alias: "MIA", record: "1-0", prob: 56 },
  },
  {
    id: "cin-pit",
    status: "preview",
    kickoff: "Mon 8:15 PM ET",
    teamA: { alias: "PIT", record: "1-0", prob: 51 },
    teamB: { alias: "CIN", record: "0-1", prob: 49 },
  },
];

// Completed season, one year back -- every game is final. Not linked
// to game.html since the per-game stats page doesn't have historical
// data to show for these ids.
const PRIOR_SEASON_1_MATCHUPS = [
  {
    id: "py1-kc-buf",
    premier: true,
    status: "final",
    kickoff: "Final",
    teamA: { alias: "BUF", record: "11-6", score: 24 },
    teamB: { alias: "KC", record: "14-3", score: 27, winner: true },
  },
  {
    id: "py1-sf-dal",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "DAL", record: "7-10", score: 20 },
    teamB: { alias: "SF", record: "12-5", score: 30, winner: true },
  },
  {
    id: "py1-phi-bal",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "BAL", record: "12-5", score: 27, winner: true },
    teamB: { alias: "PHI", record: "11-6", score: 21 },
  },
  {
    id: "py1-det-gb",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "GB", record: "11-6", score: 27, winner: true },
    teamB: { alias: "DET", record: "12-5", score: 24 },
  },
  {
    id: "py1-mia-nyj",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "NYJ", record: "5-12", score: 17 },
    teamB: { alias: "MIA", record: "8-9", score: 20, winner: true },
  },
  {
    id: "py1-cin-pit",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "PIT", record: "10-7", score: 20 },
    teamB: { alias: "CIN", record: "9-8", score: 23, winner: true },
  },
];

// Completed season, two years back -- same idea, different outcomes.
const PRIOR_SEASON_2_MATCHUPS = [
  {
    id: "py2-kc-buf",
    premier: true,
    status: "final",
    kickoff: "Final",
    teamA: { alias: "BUF", record: "10-7", score: 17 },
    teamB: { alias: "KC", record: "15-2", score: 31, winner: true },
  },
  {
    id: "py2-sf-dal",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "DAL", record: "9-8", score: 27, winner: true },
    teamB: { alias: "SF", record: "10-7", score: 20 },
  },
  {
    id: "py2-phi-bal",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "BAL", record: "10-7", score: 21 },
    teamB: { alias: "PHI", record: "11-6", score: 24, winner: true },
  },
  {
    id: "py2-det-gb",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "GB", record: "9-8", score: 20 },
    teamB: { alias: "DET", record: "13-4", score: 23, winner: true },
  },
  {
    id: "py2-mia-nyj",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "NYJ", record: "6-11", score: 24, winner: true },
    teamB: { alias: "MIA", record: "9-8", score: 23 },
  },
  {
    id: "py2-cin-pit",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "PIT", record: "11-6", score: 27, winner: true },
    teamB: { alias: "CIN", record: "8-9", score: 24 },
  },
];

const SEASONS = {
  [CURRENT_SEASON_YEAR]: { current: true, matchups: CURRENT_SEASON_MATCHUPS },
  [CURRENT_SEASON_YEAR - 1]: { current: false, matchups: PRIOR_SEASON_1_MATCHUPS },
  [CURRENT_SEASON_YEAR - 2]: { current: false, matchups: PRIOR_SEASON_2_MATCHUPS },
};

let activeSeason = CURRENT_SEASON_YEAR;

// isMember() comes from auth-nav.js, loaded before this file.

function statusTag(status) {
  if (status === "live") {
    return `<span class="tag live"><span class="blip"></span>LIVE</span>`;
  }
  if (status === "final") {
    return `<span class="tag final">FINAL</span>`;
  }
  return `<span class="tag preview">UPCOMING</span>`;
}

function teamRow(side, status) {
  const team = teamByAlias(side.alias) || { name: side.alias, market: "" };
  const isFinal = status === "final";
  const isWinner = !!side.winner;

  const metric = isFinal
    ? `<div class="team-score">${side.score}</div>`
    : `
      <div class="team-prob">${side.prob}%</div>
      <div class="prob-bar"><div class="prob-bar-fill" style="width:${side.prob}%"></div></div>
    `;

  return `
    <div class="team-row ${isWinner ? "winner" : ""}">
      <div class="team-badge">
        <img src="${teamLogoPath(side.alias)}" alt="${team.name} logo"
             onerror="this.parentElement.classList.add('fallback'); this.replaceWith(document.createTextNode('${side.alias}'));">
      </div>
      <div class="team-info">
        <div class="team-name">${team.market} ${team.name}</div>
        <div class="team-record">${side.record}</div>
      </div>
      <div class="team-metric">${metric}</div>
    </div>
  `;
}

function matchupCard(m, extraClass) {
  const card = `
    <div class="matchup-card ${extraClass || ""}">
      <div class="matchup-status">
        ${statusTag(m.status)}
        <span class="game-meta">${m.kickoff}</span>
      </div>
      ${teamRow(m.teamA, m.status)}
      <div class="vs-divider">VS</div>
      ${teamRow(m.teamB, m.status)}
    </div>
  `;

  // Only the current season links into the per-game stats page --
  // game.js doesn't have historical data for past-season ids yet.
  if (!SEASONS[activeSeason].current) return card;

  return `<a class="matchup-card-link" href="game.html?id=${m.id}">${card}</a>`;
}

function renderSeasonRail() {
  const rail = document.getElementById("season-rail");
  const years = Object.keys(SEASONS).sort((a, b) => b - a);
  rail.innerHTML = years.map(
    (y) => `<button class="week-pill ${Number(y) === activeSeason ? "active" : ""}" data-season="${y}">${y}</button>`
  ).join("");

  rail.addEventListener("click", (e) => {
    const btn = e.target.closest(".week-pill");
    if (!btn) return;
    activeSeason = Number(btn.dataset.season);
    rail.querySelectorAll(".week-pill").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    renderHeader();
    renderPremier();
    renderGrid();
  });
}

function renderHeader() {
  document.getElementById("page-title").textContent = `${activeSeason} SEASON — WEEK ${CURRENT_WEEK} PREDICTIONS`;
  document.getElementById("slate-label").textContent = `FULL WEEK ${CURRENT_WEEK} SLATE`;
  document.getElementById("premier-ribbon-text").textContent = SEASONS[activeSeason].current
    ? "★ GAME OF THE WEEK — FREE PREVIEW"
    : "★ FEATURED GAME — FREE PREVIEW";
}

function renderWeekRail() {
  const rail = document.getElementById("week-rail");
  rail.innerHTML = WEEKS.map(
    (w) => `<button class="week-pill ${w === CURRENT_WEEK ? "active" : ""}" data-week="${w}">WK ${w}</button>`
  ).join("");

  rail.addEventListener("click", (e) => {
    const btn = e.target.closest(".week-pill");
    if (!btn) return;
    rail.querySelectorAll(".week-pill").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    // Demo only -- matchup data below doesn't change per week yet.
  });
}

function renderPremier() {
  const premier = SEASONS[activeSeason].matchups.find((m) => m.premier);
  document.getElementById("premier-slot").innerHTML = matchupCard(premier, "premier-card");
}

function renderGrid() {
  const rest = SEASONS[activeSeason].matchups.filter((m) => !m.premier);
  document.getElementById("matchup-grid").innerHTML = rest.map((m) => matchupCard(m)).join("");

  const section = document.getElementById("locked-section");
  const panel = document.getElementById("unlock-panel");
  if (isMember()) {
    section.classList.remove("is-locked");
    panel.style.display = "none";
  } else {
    section.classList.add("is-locked");
    panel.style.display = "flex";
  }
}

function renderDevToggle() {
  document.getElementById("dev-toggle-btn").addEventListener("click", () => {
    if (isMember()) {
      localStorage.removeItem("sw_member");
      localStorage.removeItem("sw_first_name");
    } else {
      localStorage.setItem("sw_member", "true");
    }
    location.reload();
  });
}

renderSeasonRail();
renderHeader();
renderWeekRail();
renderPremier();
renderGrid();
renderDevToggle();
