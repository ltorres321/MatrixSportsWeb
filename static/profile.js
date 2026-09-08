// Profile page. DESIGN PREVIEW ONLY -- there is no real login/session
// system yet (see main.py's header: /subscribe just captures a lead,
// it doesn't create a session). This page can't actually know which
// subscriber row is "you", so every field here is unfilled and every
// "Save" just confirms the click rather than writing anywhere. Real
// editing needs a real auth system first -- see the architecture note
// in project memory about Supabase Auth vs. a custom build.

function populateFavoriteTeamSelect() {
  const select = document.getElementById("profile-team");
  TEAMS.forEach((team) => {
    const opt = document.createElement("option");
    opt.value = team.alias;
    opt.textContent = `${team.market} ${team.name}`;
    select.appendChild(opt);
  });
}

function wireFormPreviewSubmit() {
  const note = document.getElementById("profile-save-note");
  document.querySelectorAll("[data-profile-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      note.textContent = "Design preview only -- profile changes aren't saved anywhere yet.";
    });
  });
}

function render() {
  const gate = document.getElementById("signed-out-gate");
  const content = document.getElementById("profile-content");

  if (!isMember()) {
    gate.style.display = "block";
    content.style.display = "none";
    return;
  }

  gate.style.display = "none";
  content.style.display = "block";

  const firstName = localStorage.getItem("sw_first_name");
  document.getElementById("profile-subtitle").textContent = firstName
    ? `// account settings for ${firstName}`
    : "// account settings";

  populateFavoriteTeamSelect();
  wireFormPreviewSubmit();
}

render();
