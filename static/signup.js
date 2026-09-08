// Free account signup form. Submits to POST /subscribe (main.py),
// which persists into the subscribers table -- see
// sql/001_subscribers_schema.sql. The "sw_member" localStorage flag
// set on success is a separate, client-side-only thing: it's what the
// free/locked gating on home.html checks, since there's still no real
// login/session system yet. That's the next piece after this.

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

function setSubmitting(isSubmitting) {
  const btn = document.querySelector("#signup-form button[type=submit]");
  btn.disabled = isSubmitting;
  btn.textContent = isSubmitting ? "Creating Account..." : "Create Free Account";
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    firstName: form.firstName.value,
    middleName: form.middleName.value,
    lastName: form.lastName.value,
    email: form.email.value,
    cell: form.cell.value,
    address: form.address.value,
    city: form.city.value,
    state: form.state.value,
    zip: form.zip.value,
    favoriteTeam: form.favoriteTeam.value,
    notify: form.notify.checked,
  };

  if (!validateForm(data)) return;

  setSubmitting(true);
  setError("email", "");

  try {
    const response = await fetch("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: data.firstName,
        middle_name: data.middleName || null,
        last_name: data.lastName,
        email: data.email,
        cell: data.cell || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        favorite_team: data.favoriteTeam || null,
        notify_win_prob: data.notify,
      }),
    });

    if (response.status === 409) {
      setError("email", "An account with that email already exists.");
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError("email", body.detail || "Something went wrong -- please try again.");
      setSubmitting(false);
      return;
    }

    // Client-side-only "logged in" flag for the home.html demo gating
    // -- see file header. The actual signup is already saved server-side.
    localStorage.setItem("sw_member", "true");
    localStorage.setItem("sw_first_name", data.firstName.trim());

    form.style.display = "none";
    document.getElementById("form-success").classList.add("show");

    setTimeout(() => {
      window.location.href = "home.html";
    }, 1600);
  } catch (err) {
    setError("email", "Couldn't reach the server -- please try again.");
    setSubmitting(false);
  }
}

populateFavoriteTeams();
document.getElementById("notify").addEventListener("change", syncCellRequirement);
document.getElementById("signup-form").addEventListener("submit", handleSubmit);
syncCellRequirement();
