// Free account signup form. IMPORTANT: this is UI-only right now --
// there is no backend endpoint yet, so nothing here is persisted
// server-side. Submitting just sets a local "sw_member" flag (read by
// home.js) so the free/locked gating on home.html can be previewed,
// and stashes the first name for a personalized nav greeting. Real
// signups need a POST endpoint + storage before this goes live.

function populateFavoriteTeams() {
  const select = document.getElementById("favorite-team");
  TEAMS.forEach((team) => {
    const opt = document.createElement("option");
    opt.value = team.alias;
    opt.textContent = `${team.market} ${team.name}`;
    select.appendChild(opt);
  });
}

function setError(fieldId, message) {
  const errorEl = document.querySelector(`[data-error-for="${fieldId}"]`);
  const inputEl = document.getElementById(fieldId);
  if (errorEl) errorEl.textContent = message || "";
  if (inputEl) inputEl.classList.toggle("invalid", !!message);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

function syncCellRequirement() {
  const notify = document.getElementById("notify").checked;
  const tag = document.getElementById("cell-optional-tag");
  tag.style.display = notify ? "none" : "inline";
}

function validateForm(data) {
  let valid = true;

  if (!data.firstName.trim()) {
    setError("first-name", "Required");
    valid = false;
  } else {
    setError("first-name", "");
  }

  if (!data.lastName.trim()) {
    setError("last-name", "Required");
    valid = false;
  } else {
    setError("last-name", "");
  }

  if (!data.email.trim() || !isValidEmail(data.email)) {
    setError("email", "Enter a valid email");
    valid = false;
  } else {
    setError("email", "");
  }

  const cellDigits = digitsOnly(data.cell);
  if (data.notify && cellDigits.length < 10) {
    setError("cell", "Cell number required for text notifications");
    valid = false;
  } else if (cellDigits && cellDigits.length < 10) {
    setError("cell", "Enter a valid phone number");
    valid = false;
  } else {
    setError("cell", "");
  }

  if (data.zip && !/^\d{5}(-\d{4})?$/.test(data.zip.trim())) {
    setError("zip", "Use ZIP or ZIP+4 format");
    valid = false;
  } else {
    setError("zip", "");
  }

  return valid;
}

function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    firstName: form.firstName.value,
    middleName: form.middleName.value,
    lastName: form.lastName.value,
    email: form.email.value,
    cell: form.cell.value,
    city: form.city.value,
    state: form.state.value,
    zip: form.zip.value,
    favoriteTeam: form.favoriteTeam.value,
    notify: form.notify.checked,
  };

  if (!validateForm(data)) return;

  // Demo-only "account creation" -- see file header.
  localStorage.setItem("sw_member", "true");
  localStorage.setItem("sw_first_name", data.firstName.trim());

  form.style.display = "none";
  document.getElementById("form-success").classList.add("show");

  setTimeout(() => {
    window.location.href = "home.html";
  }, 1600);
}

populateFavoriteTeams();
document.getElementById("notify").addEventListener("change", syncCellRequirement);
document.getElementById("signup-form").addEventListener("submit", handleSubmit);
syncCellRequirement();
