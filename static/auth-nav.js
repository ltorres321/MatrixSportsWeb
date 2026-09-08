// Shared nav auth-state rendering, used by every page's navbar so
// "member" status (still just a localStorage flag -- see home.js's
// header comment on why there's no real login yet) looks consistent
// everywhere instead of being copy-pasted per page.
//
// Expects a navbar with: #member-pill-slot, #nav-signup-link, and
// optionally #nav-profile-link (hidden for non-members).

function isMember() {
  return localStorage.getItem("sw_member") === "true";
}

function renderAuthNav() {
  const pillSlot = document.getElementById("member-pill-slot");
  const signupLink = document.getElementById("nav-signup-link");
  const profileLink = document.getElementById("nav-profile-link");

  if (isMember()) {
    const firstName = localStorage.getItem("sw_first_name");
    if (pillSlot) {
      pillSlot.innerHTML = `<span class="member-pill">✓ Free Member${firstName ? " — " + firstName : ""}</span>`;
    }
    if (profileLink) profileLink.style.display = "";
    if (signupLink) {
      signupLink.textContent = "Reset Demo";
      signupLink.href = "#";
      signupLink.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("sw_member");
        localStorage.removeItem("sw_first_name");
        window.location.href = "index.html";
      });
    }
  } else {
    if (pillSlot) pillSlot.innerHTML = "";
    if (profileLink) profileLink.style.display = "none";
    if (signupLink) {
      signupLink.textContent = "Sign Up Free";
      signupLink.href = "signup.html";
    }
  }
}

renderAuthNav();
