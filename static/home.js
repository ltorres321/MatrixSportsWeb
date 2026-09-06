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

const MATCHUPS = [
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

function isMember() {
  return localStorage.getItem("sw_member") === "true";
}

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
  return `
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
  const premier = MATCHUPS.find((m) => m.premier);
  document.getElementById("premier-slot").innerHTML = matchupCard(premier, "premier-card");
}

function renderGrid() {
  const rest = MATCHUPS.filter((m) => !m.premier);
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

function renderNav() {
  const pillSlot = document.getElementById("member-pill-slot");
  const signupLink = document.getElementById("nav-signup-link");

  if (isMember()) {
    const firstName = localStorage.getItem("sw_first_name");
    pillSlot.innerHTML = `<span class="member-pill">✓ Free Member${firstName ? " — " + firstName : ""}</span>`;
    signupLink.textContent = "Reset Demo";
    signupLink.href = "#";
    signupLink.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("sw_member");
      localStorage.removeItem("sw_first_name");
      location.reload();
    });
  } else {
    pillSlot.innerHTML = "";
    signupLink.textContent = "Sign Up Free";
    signupLink.href = "signup.html";
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

renderWeekRail();
renderPremier();
renderGrid();
renderNav();
renderDevToggle();
