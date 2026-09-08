// "Sticky stats" per-game detail page. PLACEHOLDER DATA ONLY -- see
// static/game.html's footer note. The real prediction model already
// computes every stat shape used below (win probability, margin-of-
// victory buckets, total-score over/under at 5 lines, margin
// percentiles) in the live `latest_predictions` view -- this page
// just isn't reading from it yet, on purpose, until the design is
// finalized across the whole site.

const GAMES = {
  "kc-buf": {
    premier: true,
    status: "preview",
    kickoff: "Sun 1:00 PM ET",
    marketLine: { spread: "KC -2.5", total: 46.5 },
    teamA: { alias: "BUF", record: "1-0", winProb: 47 },
    teamB: { alias: "KC", record: "1-0", winProb: 53 },
    favored: "teamB",
    expectedScore: { teamA: 23.1, teamB: 26.4 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 47 },
      { label: "Won by 1-3", pct: 15 },
      { label: "Won by 4-7", pct: 14 },
      { label: "Won by 8-14", pct: 13 },
      { label: "Won by 15-21", pct: 7 },
      { label: "Won by 21+", pct: 4 },
    ],
    marginPercentiles: { p05: -17, p25: -3, p50: 3, p75: 10, p95: 24 },
    totals: [
      { line: 30, over: 92, under: 8 },
      { line: 40, over: 78, under: 22 },
      { line: 44, over: 64, under: 36 },
      { line: 48, over: 47, under: 53 },
      { line: 52, over: 29, under: 71 },
    ],
  },
  "sf-dal": {
    status: "preview",
    kickoff: "Sun 4:25 PM ET",
    marketLine: { spread: "SF -5.5", total: 44.5 },
    teamA: { alias: "DAL", record: "0-1", winProb: 38 },
    teamB: { alias: "SF", record: "1-0", winProb: 62 },
    favored: "teamB",
    expectedScore: { teamA: 19.8, teamB: 26.9 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 38 },
      { label: "Won by 1-3", pct: 12 },
      { label: "Won by 4-7", pct: 16 },
      { label: "Won by 8-14", pct: 18 },
      { label: "Won by 15-21", pct: 10 },
      { label: "Won by 21+", pct: 6 },
    ],
    marginPercentiles: { p05: -12, p25: 1, p50: 8, p75: 15, p95: 27 },
    totals: [
      { line: 30, over: 89, under: 11 },
      { line: 40, over: 71, under: 29 },
      { line: 44, over: 55, under: 45 },
      { line: 48, over: 38, under: 62 },
      { line: 52, over: 21, under: 79 },
    ],
  },
  "phi-bal": {
    status: "live",
    kickoff: "Q3 08:42",
    marketLine: { spread: "PHI -1.5", total: 47.5 },
    teamA: { alias: "BAL", record: "0-1", winProb: 41, score: 17 },
    teamB: { alias: "PHI", record: "1-0", winProb: 59, score: 24 },
    favored: "teamB",
    expectedScore: { teamA: 21.4, teamB: 27.8 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 41 },
      { label: "Won by 1-3", pct: 13 },
      { label: "Won by 4-7", pct: 15 },
      { label: "Won by 8-14", pct: 16 },
      { label: "Won by 15-21", pct: 9 },
      { label: "Won by 21+", pct: 6 },
    ],
    marginPercentiles: { p05: -14, p25: -1, p50: 6, p75: 13, p95: 25 },
    totals: [
      { line: 30, over: 94, under: 6 },
      { line: 40, over: 81, under: 19 },
      { line: 44, over: 69, under: 31 },
      { line: 48, over: 52, under: 48 },
      { line: 52, over: 33, under: 67 },
    ],
    liveNote: "Live probabilities update with the game; pregame figures above are what the model projected before kickoff.",
  },
  "det-gb": {
    status: "final",
    kickoff: "Final",
    marketLine: { spread: "DET -3.5", total: 45.5 },
    teamA: { alias: "GB", record: "0-1", winProb: 39, score: 20 },
    teamB: { alias: "DET", record: "2-0", winProb: 61, score: 27, winner: true },
    favored: "teamB",
    expectedScore: { teamA: 21.0, teamB: 24.6 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 39 },
      { label: "Won by 1-3", pct: 14 },
      { label: "Won by 4-7", pct: 17 },
      { label: "Won by 8-14", pct: 16 },
      { label: "Won by 15-21", pct: 9 },
      { label: "Won by 21+", pct: 5 },
    ],
    marginPercentiles: { p05: -13, p25: 0, p50: 5, p75: 11, p95: 23 },
    totals: [
      { line: 30, over: 90, under: 10 },
      { line: 40, over: 74, under: 26 },
      { line: 44, over: 58, under: 42 },
      { line: 48, over: 41, under: 59 },
      { line: 52, over: 24, under: 76 },
    ],
    finalResult: { winnerAlias: "DET", margin: 7, totalScore: 47 },
  },
  "mia-nyj": {
    status: "preview",
    kickoff: "Sun 1:00 PM ET",
    marketLine: { spread: "MIA -1.5", total: 42.5 },
    teamA: { alias: "NYJ", record: "0-1", winProb: 44 },
    teamB: { alias: "MIA", record: "1-0", winProb: 56 },
    favored: "teamB",
    expectedScore: { teamA: 20.2, teamB: 22.9 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 44 },
      { label: "Won by 1-3", pct: 16 },
      { label: "Won by 4-7", pct: 15 },
      { label: "Won by 8-14", pct: 13 },
      { label: "Won by 15-21", pct: 7 },
      { label: "Won by 21+", pct: 5 },
    ],
    marginPercentiles: { p05: -16, p25: -4, p50: 2, p75: 9, p95: 20 },
    totals: [
      { line: 30, over: 87, under: 13 },
      { line: 40, over: 66, under: 34 },
      { line: 44, over: 49, under: 51 },
      { line: 48, over: 33, under: 67 },
      { line: 52, over: 18, under: 82 },
    ],
  },
  "cin-pit": {
    status: "preview",
    kickoff: "Mon 8:15 PM ET",
    marketLine: { spread: "PIT -0.5", total: 43.5 },
    teamA: { alias: "PIT", record: "1-0", winProb: 51 },
    teamB: { alias: "CIN", record: "0-1", winProb: 49 },
    favored: "teamA",
    expectedScore: { teamA: 22.6, teamB: 22.1 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 49 },
      { label: "Won by 1-3", pct: 17 },
      { label: "Won by 4-7", pct: 14 },
      { label: "Won by 8-14", pct: 11 },
      { label: "Won by 15-21", pct: 6 },
      { label: "Won by 21+", pct: 3 },
    ],
    marginPercentiles: { p05: -19, p25: -6, p50: 0, p75: 6, p95: 17 },
    totals: [
      { line: 30, over: 88, under: 12 },
      { line: 40, over: 68, under: 32 },
      { line: 44, over: 50, under: 50 },
      { line: 48, over: 34, under: 66 },
      { line: 52, over: 19, under: 81 },
    ],
  },
};

const PERCENTILE_MIN = -30;
const PERCENTILE_MAX = 30;

// isMember() comes from auth-nav.js, loaded before this file.

function getGameId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "kc-buf";
}

function teamDisplay(alias) {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

function pct(n) {
  return `${n}%`;
}

function scalePosition(value) {
  const clamped = Math.max(PERCENTILE_MIN, Math.min(PERCENTILE_MAX, value));
  return ((clamped - PERCENTILE_MIN) / (PERCENTILE_MAX - PERCENTILE_MIN)) * 100;
}

function renderStickyBar(game) {
  const statusWord = game.status === "final" ? "FINAL" : game.status === "live" ? "LIVE" : game.kickoff;
  document.getElementById("sticky-bar-slot").innerHTML = `
    <div class="game-sticky-bar">
      <div class="side">
        <img src="${teamLogoPath(game.teamA.alias)}" alt="">
        <span>${game.teamA.alias}</span>
        ${game.status === "final" ? `<span class="prob">${game.teamA.score}</span>` : `<span class="prob">${game.teamA.winProb}%</span>`}
      </div>
      <div class="vs">${statusWord}</div>
      <div class="side">
        ${game.status === "final" ? `<span class="prob">${game.teamB.score}</span>` : `<span class="prob">${game.teamB.winProb}%</span>`}
        <span>${game.teamB.alias}</span>
        <img src="${teamLogoPath(game.teamB.alias)}" alt="">
      </div>
    </div>
  `;
}

function heroTeamBlock(side, game) {
  const metric = game.status === "final"
    ? `<div class="big-prob">${side.score}</div>`
    : `<div class="big-prob">${side.winProb}<span class="unit">%</span></div>`;

  return `
    <div class="game-hero-team">
      <img src="${teamLogoPath(side.alias)}" alt="${teamDisplay(side.alias)} logo">
      <div class="name">${teamDisplay(side.alias)}</div>
      <div class="record">${side.record}</div>
      ${metric}
    </div>
  `;
}

function renderHero(game) {
  const tag = game.status === "live"
    ? `<span class="tag live"><span class="blip"></span>LIVE — ${game.kickoff}</span>`
    : game.status === "final"
      ? `<span class="tag final">FINAL</span>`
      : `<span class="tag preview">${game.kickoff}</span>`;

  return `
    <div class="game-hero">
      <div class="matchup-status" style="justify-content:center; margin-bottom:1.5rem;">${tag}</div>
      <div class="game-hero-teams">
        ${heroTeamBlock(game.teamA, game)}
        <div class="game-hero-vs">VS</div>
        ${heroTeamBlock(game.teamB, game)}
      </div>
      <div class="game-hero-meta">
        Market line: ${game.marketLine.spread}, total ${game.marketLine.total} &middot;
        Model expected score: ${teamDisplay(game.teamA.alias)} ${game.expectedScore.teamA.toFixed(1)} &ndash;
        ${teamDisplay(game.teamB.alias)} ${game.expectedScore.teamB.toFixed(1)}
      </div>
      ${game.liveNote ? `<div class="game-hero-meta" style="margin-top:0.5rem;">${game.liveNote}</div>` : ""}
    </div>
  `;
}

function renderMarginSection(game) {
  const favored = game[game.favored];
  const rows = game.marginBuckets.map(
    (b) => `
      <div class="bucket-row">
        <span class="bucket-label">${b.label}</span>
        <div class="bucket-track"><div class="bucket-fill" style="width:${b.pct}%"></div></div>
        <span class="bucket-pct">${pct(b.pct)}</span>
      </div>
    `
  ).join("");

  return `
    <div class="stat-section">
      <h2>Margin of Victory — ${teamDisplay(favored.alias)}</h2>
      <p class="stat-sub">How often each outcome happened across every simulated version of this game.</p>
      <div class="bucket-list">${rows}</div>
    </div>
  `;
}

function renderTotalsSection(game) {
  const cards = game.totals.map(
    (t) => `
      <div class="totals-card">
        <div class="line">TOTAL ${t.line}</div>
        <div class="split">
          <div class="over" style="width:${t.over}%"></div>
          <div class="under" style="width:${t.under}%"></div>
        </div>
        <div class="readout">
          <span class="over-pct">${t.over}% over</span>
          <span class="under-pct">${t.under}% under</span>
        </div>
      </div>
    `
  ).join("");

  return `
    <div class="stat-section">
      <h2>Total Score — Over / Under</h2>
      <p class="stat-sub">Combined final score against five common lines.</p>
      <div class="totals-grid">${cards}</div>
    </div>
  `;
}

function renderPercentileSection(game) {
  const favored = game[game.favored];
  const p = game.marginPercentiles;
  const bandLeft = scalePosition(p.p25);
  const bandRight = scalePosition(p.p75);

  return `
    <div class="stat-section">
      <h2>Projected Margin Range — ${teamDisplay(favored.alias)}</h2>
      <p class="stat-sub">Negative means ${teamDisplay(favored.alias)} lost by that many points. The shaded band is the 25th&ndash;75th percentile; the dot is the median.</p>
      <div class="percentile-block">
        <div class="percentile-track">
          <div class="percentile-zero-line" style="left:${scalePosition(0)}%"></div>
          <div class="percentile-band" style="left:${bandLeft}%; width:${bandRight - bandLeft}%"></div>
          <div class="percentile-marker" style="left:${scalePosition(p.p50)}%"></div>
          <div class="percentile-tick" style="left:${scalePosition(p.p05)}%">P05: ${p.p05 > 0 ? "+" : ""}${p.p05}</div>
          <div class="percentile-tick" style="left:${scalePosition(p.p95)}%">P95: ${p.p95 > 0 ? "+" : ""}${p.p95}</div>
        </div>
      </div>
    </div>
  `;
}

function renderResultCompare(game) {
  if (!game.finalResult) return "";
  const projected = game[game.favored].winProb;
  const winnerName = teamDisplay(game.finalResult.winnerAlias);

  return `
    <div class="stat-section">
      <h2>Prediction vs. Result</h2>
      <p class="stat-sub">We keep every prediction permanently so we can always show our work.</p>
      <div class="result-compare">
        <div class="compare-card">
          <div class="label">PREGAME WIN PROBABILITY</div>
          <div class="value">${winnerName.split(" ").pop()} ${projected}%</div>
        </div>
        <div class="compare-card hit">
          <div class="label">ACTUAL RESULT</div>
          <div class="value">${winnerName} won by ${game.finalResult.margin}</div>
        </div>
        <div class="compare-card">
          <div class="label">COMBINED SCORE</div>
          <div class="value">${game.finalResult.totalScore}</div>
        </div>
      </div>
    </div>
  `;
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

function render() {
  const gameId = getGameId();
  const game = GAMES[gameId] || GAMES["kc-buf"];
  const locked = !game.premier && !isMember();

  renderStickyBar(game);
  renderDevToggle();

  const content = document.getElementById("game-content");
  const lockedSection = document.getElementById("locked-section");

  if (locked) {
    content.innerHTML = renderHero(game);
    lockedSection.style.display = "block";
    lockedSection.classList.add("is-locked");
    // .locked-section.is-locked .matchup-grid is the same blur rule
    // home.js's locked slate uses -- reused here so blurred vs. real
    // stats look identical.
    const filler = document.createElement("div");
    filler.className = "matchup-grid";
    filler.innerHTML = renderMarginSection(game) + renderTotalsSection(game);
    lockedSection.insertBefore(filler, document.getElementById("unlock-panel"));
  } else {
    content.innerHTML =
      renderHero(game) +
      renderResultCompare(game) +
      renderMarginSection(game) +
      renderTotalsSection(game) +
      renderPercentileSection(game);
    lockedSection.style.display = "none";
  }
}

render();
