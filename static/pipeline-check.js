// Deliberately minimal, vanilla JS -- no build step, no framework.
// Fetches /games/upcoming and renders one card per game. See Stage 5
// of the production plan for what's explicitly out of scope here.

const MARGIN_BUCKETS = [
  ["margin_bucket_lost_or_tied", "Lost or tied"],
  ["margin_bucket_won_1_3", "Won by 1-3"],
  ["margin_bucket_won_4_7", "Won by 4-7"],
  ["margin_bucket_won_8_14", "Won by 8-14"],
  ["margin_bucket_won_15_21", "Won by 15-21"],
  ["margin_bucket_won_21_plus", "Won by 21+"],
];

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatKickoff(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

function bestMarginBucket(game) {
  let best = MARGIN_BUCKETS[0];
  for (const entry of MARGIN_BUCKETS) {
    if (game[entry[0]] > game[best[0]]) {
      best = entry;
    }
  }
  return { label: best[1], probability: game[best[0]] };
}

function renderGameCard(game) {
  const homeWinPct = game.home_win_probability * 100;
  const topBucket = bestMarginBucket(game);
  const spreadLabel = game.market_spread_line_current >= 0
    ? `${game.home_team} favored by ${game.market_spread_line_current.toFixed(1)}`
    : `${game.away_team} favored by ${Math.abs(game.market_spread_line_current).toFixed(1)}`;

  const card = document.createElement("div");
  card.className = "game-card";
  card.innerHTML = `
    <div class="matchup">
      <h2>${game.away_team} @ ${game.home_team}</h2>
      <span class="kickoff">${formatKickoff(game.game_date)}</span>
    </div>

    <div class="win-bar-row">
      <div class="win-bar">
        <div class="win-bar-fill" style="width: ${homeWinPct.toFixed(1)}%;"></div>
      </div>
      <span class="win-bar-label">
        ${game.home_team} ${formatPercent(game.home_win_probability)} to win
      </span>
    </div>

    <dl class="details-grid">
      <div><dt>Expected score</dt>
        <dd>${game.home_team} ${game.expected_home_score.toFixed(1)} &ndash;
            ${game.away_team} ${game.expected_away_score.toFixed(1)}</dd></div>
      <div><dt>Market line</dt>
        <dd>${spreadLabel}, total ${game.market_total_line_current.toFixed(1)}</dd></div>
      <div><dt>Most likely margin</dt>
        <dd>${topBucket.label} (${formatPercent(topBucket.probability)})</dd></div>
      <div><dt>Total over/under 44</dt>
        <dd>${formatPercent(game.total_over_44)} over / ${formatPercent(game.total_under_44)} under</dd></div>
    </dl>
  `;
  return card;
}

async function loadUpcomingGames() {
  const statusEl = document.getElementById("status");
  const gamesEl = document.getElementById("games");

  statusEl.textContent = "Loading upcoming games...";
  statusEl.className = "";

  try {
    const response = await fetch("/games/upcoming");
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    const games = await response.json();

    if (games.length === 0) {
      statusEl.textContent = "No upcoming games with predictions right now.";
      return;
    }

    statusEl.textContent = "";
    gamesEl.innerHTML = "";
    for (const game of games) {
      gamesEl.appendChild(renderGameCard(game));
    }
  } catch (err) {
    statusEl.textContent = `Couldn't load predictions: ${err.message}`;
    statusEl.className = "error";
  }
}

loadUpcomingGames();
