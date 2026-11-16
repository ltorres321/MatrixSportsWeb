"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMemberPreview } from "@/lib/useMemberPreview";
import { TEAMS } from "@/lib/teams";
import { NBA_TEAMS } from "@/lib/teamsNba";
import { SPORTSBOOKS, COIN_BASED_BOOK_IDS } from "@/lib/sportsbooks";
import { SportsbookPickerModal } from "@/components/SportsbookPickerModal";
import { PillPickerModal } from "@/components/PillPickerModal";
import { ODDS_FORMATS, DEFAULT_ODDS_FORMAT, type OddsFormat } from "@/lib/oddsFormat";

interface ProfileRow {
  first_name: string;
  last_name: string;
  email: string | null;
  notification_email: string | null;
  cell: string | null;
  cell_verified: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  favorite_team: string | null;
  favorite_nba_team: string | null;
  notify_win_prob: boolean;
  notify_teams: string[];
  theme: "dark" | "light";
  matrix_rain_enabled: boolean;
  enabled_sportsbooks: string[];
  odds_format: OddsFormat;
}

// Supabase/Twilio require E.164 (+<country code><number>, digits
// only, no spaces/punctuation) -- a plain "(555) 555-5555" fails
// validation outright. Rather than a full country picker (a
// maintained country list + per-country length rules for an audience
// that's overwhelmingly US-based right now), this strips whatever
// punctuation was typed and adds the "+" for the user: assumes US
// unless "International Number" is checked, in which case the digits
// are trusted to already start with the right country code. Returns
// null when the domestic digit count doesn't look like a real US
// number, so the caller can ask the user to check the box instead of
// silently sending something wrong.
// TEAMS/NBA_TEAMS entries are {alias, name, market} -- every display
// spot and picker option below shows the full "Arizona Cardinals" form,
// not just "Cardinals", so this is the one place that formatting lives.
function teamLabel(t: { market: string; name: string }): string {
  return `${t.market} ${t.name}`;
}

function normalizePhoneNumber(raw: string, international: boolean): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (international) {
    return `+${digits}`;
  }

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loaded, isRealMember, previewOn } = useMemberPreview();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saveNote, setSaveNote] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cellInput, setCellInput] = useState("");
  const [cellIsInternational, setCellIsInternational] = useState(false);
  const [cellOtpSent, setCellOtpSent] = useState(false);
  const [cellOtpCode, setCellOtpCode] = useState("");
  const [cellNote, setCellNote] = useState("");
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [bookiesNote, setBookiesNote] = useState("");
  // "Coin Based Books" gate (user, 2026-11-16) -- derived from whether
  // the saved profile already has one of COIN_BASED_BOOK_IDS selected,
  // not its own DB column; see toggleCoinBooks's own comment for why.
  const [coinBooksEnabled, setCoinBooksEnabled] = useState(false);
  // "Site Odds Preference" (user, 2026-11-16: "American Odds, Decimal,
  // Fractional ... this will change how odds are displayed across
  // site") -- profiles.odds_format (sql/019), default American.
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>(DEFAULT_ODDS_FORMAT);
  const [oddsFormatNote, setOddsFormatNote] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [favoriteTeamPickerOpen, setFavoriteTeamPickerOpen] = useState(false);
  const [favoriteTeamNote, setFavoriteTeamNote] = useState("");
  const [favoriteNbaTeam, setFavoriteNbaTeam] = useState<string | null>(null);
  const [favoriteNbaTeamPickerOpen, setFavoriteNbaTeamPickerOpen] = useState(false);
  const [favoriteNbaTeamNote, setFavoriteNbaTeamNote] = useState("");
  const [notifyTeams, setNotifyTeams] = useState<string[]>([]);
  const [notifyTeamsPickerOpen, setNotifyTeamsPickerOpen] = useState(false);
  const [notifyTeamsNote, setNotifyTeamsNote] = useState("");

  useEffect(() => {
    if (!isRealMember || !user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const row = data as ProfileRow | null;
        setProfile(row);
        setCellInput(row?.cell ?? "");
        setSelectedBooks(row?.enabled_sportsbooks ?? []);
        setCoinBooksEnabled((row?.enabled_sportsbooks ?? []).some((b) => COIN_BASED_BOOK_IDS.includes(b)));
        setOddsFormat(row?.odds_format ?? DEFAULT_ODDS_FORMAT);
        setFavoriteTeam(row?.favorite_team ?? null);
        setFavoriteNbaTeam(row?.favorite_nba_team ?? null);
        setNotifyTeams(row?.notify_teams ?? []);
        setLoadingProfile(false);
      });
  }, [isRealMember, user]);

  // The browser's own "scroll to #hash on load" only fires once, right
  // after the initial navigation -- but this whole page returns null
  // until the auth check resolves (the `if (!loaded) return null`
  // below), so the target section doesn't exist in the DOM yet at that
  // moment and the native behavior finds nothing to scroll to. Redoing
  // it manually once the real content has actually mounted is what
  // makes a link like "Add Favorite Team -> /profile#favorite-nfl-team"
  // actually land there instead of the page top. Generic over whatever
  // hash is present (not hardcoded to one section id) now that there
  // are several deep-linkable panels (address-team, favorite-nfl-team,
  // favorite-nba-team, notify-teams, my-bookies).
  useEffect(() => {
    if (!isRealMember || loadingProfile) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isRealMember, loadingProfile]);

  // A verified cell is only trustworthy for whatever number Supabase
  // actually confirmed via OTP -- if the field's since been edited to
  // something else (not yet sent/verified), that badge has to go away
  // even though the DB still says cell_verified until the new number
  // is confirmed. profile.cell is stored normalized (E.164), so the
  // comparison has to normalize the current input the same way.
  const normalizedCellInput = normalizePhoneNumber(cellInput, cellIsInternational);
  const cellIsVerifiedForCurrentInput =
    !!profile?.cell_verified && !!normalizedCellInput && profile?.cell === normalizedCellInput;

  async function handleSendCellCode(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizePhoneNumber(cellInput, cellIsInternational);
    if (!normalized) {
      setCellNote(
        cellIsInternational
          ? "Enter the number's digits only, country code first."
          : "That doesn't look like a valid U.S. number -- check “International Number” below if it's not."
      );
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ phone: normalized });
    if (error) {
      setCellNote(error.message);
      return;
    }
    setCellOtpSent(true);
    setCellNote("Verification code sent by text -- enter it below.");
  }

  async function handleVerifyCellCode(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const normalized = normalizePhoneNumber(cellInput, cellIsInternational);
    if (!normalized) {
      setCellNote("Enter a valid number first.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: cellOtpCode.trim(),
      type: "phone_change",
    });
    if (error) {
      setCellNote(error.message);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ cell: normalized, cell_verified: true })
      .eq("id", user.id);

    setCellOtpSent(false);
    setCellOtpCode("");
    if (profileError) {
      setCellNote(profileError.message);
      return;
    }
    setProfile((prev) => (prev ? { ...prev, cell: normalized, cell_verified: true } : prev));
    setCellNote("Cell number verified.");
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setSaveNote("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSaveNote("Passwords don't match.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaveNote(error ? error.message : "Password updated.");
    if (!error) {
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleAppearanceChange(field: "theme" | "matrix_rain_enabled", value: string | boolean) {
    if (!user) return;

    // Rain is a dark-theme-only effect -- switching to light always
    // forces it off in the same write, rather than leaving a
    // light+rain-on combination sitting in the database.
    const updates: Partial<Pick<ProfileRow, "theme" | "matrix_rain_enabled">> =
      field === "theme" && value === "light"
        ? { theme: "light", matrix_rain_enabled: false }
        : { [field]: value };

    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    if (error) {
      setSaveNote(error.message);
      return;
    }
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    // layout.tsx reads theme/rain server-side, so it needs a fresh
    // render to pick up the change -- a plain state update wouldn't
    // touch it since it lives above this page in the component tree.
    router.refresh();
  }

  async function handleUpdateNotificationEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const notification_email = String(formData.get("notificationEmail") ?? "").trim() || null;

    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ notification_email }).eq("id", user.id);
    setSaveNote(error ? error.message : "Notification email updated.");
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, notification_email } : prev));
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleUpdateProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const updates = {
      address: (String(formData.get("address") ?? "").trim() || null) as string | null,
      city: (String(formData.get("city") ?? "").trim() || null) as string | null,
      state: (String(formData.get("state") ?? "").trim() || null) as string | null,
      zip: (String(formData.get("zip") ?? "").trim() || null) as string | null,
      notify_win_prob: formData.get("notify") === "on",
    };

    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    setSaveNote(error ? error.message : "Preferences saved.");
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  }

  // Shared by every Add/Edit pill section below (My Bookies, Favorite
  // NFL/NBA Team, Teams to Notify) -- pressing Done both closes that
  // section's panel and persists immediately, unlike Address & Team
  // Notifications' one big form with its own "Save Preferences" click.
  async function saveProfileField<K extends keyof ProfileRow>(
    column: K,
    value: ProfileRow[K],
    setNote: (note: string) => void
  ) {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ [column]: value } as Partial<ProfileRow>)
      .eq("id", user.id);
    setNote(error ? error.message : "Saved.");
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, [column]: value } : prev));
    }
  }

  function toggleBook(id: string) {
    setSelectedBooks((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }
  // No separate DB column -- this gate's "on" state IS "the user has a
  // coin-based book selected" (set from the saved profile on load,
  // above). Turning it off here also drops any coin books currently
  // selected, so a pill never shows both greyed-out AND active at once,
  // and Done/Save correctly persists the opt-out.
  function toggleCoinBooks() {
    setCoinBooksEnabled((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedBooks((books) => books.filter((b) => !COIN_BASED_BOOK_IDS.includes(b)));
      }
      return next;
    });
  }
  async function handleSaveBookies() {
    setBookPickerOpen(false);
    await saveProfileField("enabled_sportsbooks", selectedBooks, setBookiesNote);
  }

  // Saved immediately on click, no separate "Done" step -- there's no
  // modal here, just 3 always-visible options, so there's nothing left
  // to confirm first.
  async function handleOddsFormatChange(format: OddsFormat) {
    setOddsFormat(format);
    await saveProfileField("odds_format", format, setOddsFormatNote);
  }

  // Single-select: picking a team replaces the current one; tapping
  // the already-selected pill again clears it (matches PillPickerModal's
  // own "tap again to clear" copy for a non-multiple picker).
  function toggleFavoriteTeam(id: string) {
    setFavoriteTeam((prev) => (prev === id ? null : id));
  }
  async function handleSaveFavoriteTeam() {
    setFavoriteTeamPickerOpen(false);
    await saveProfileField("favorite_team", favoriteTeam, setFavoriteTeamNote);
  }

  function toggleFavoriteNbaTeam(id: string) {
    setFavoriteNbaTeam((prev) => (prev === id ? null : id));
  }
  async function handleSaveFavoriteNbaTeam() {
    setFavoriteNbaTeamPickerOpen(false);
    await saveProfileField("favorite_nba_team", favoriteNbaTeam, setFavoriteNbaTeamNote);
  }

  function toggleNotifyTeam(id: string) {
    setNotifyTeams((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }
  async function handleSaveNotifyTeams() {
    setNotifyTeamsPickerOpen(false);
    await saveProfileField("notify_teams", notifyTeams, setNotifyTeamsNote);
  }

  const isLightTheme = (profile?.theme ?? "dark") === "light";
  const nflTeamOptions = TEAMS.map((t) => ({ id: t.alias, name: teamLabel(t) }));
  const nbaTeamOptions = NBA_TEAMS.map((t) => ({ id: t.alias, name: teamLabel(t) }));
  const favoriteTeamLabel = TEAMS.find((t) => t.alias === favoriteTeam);
  const favoriteNbaTeamLabel = NBA_TEAMS.find((t) => t.alias === favoriteNbaTeam);

  if (!loaded) return null;

  if (!isRealMember) {
    return (
      <main className="profile-zoom">
        <div className="form-shell">
          <div className="unlock-card" style={{ maxWidth: "none" }}>
            <span className="lock-icon">🔒</span>
            <h3>Sign In to Manage Your Profile</h3>
            <p>
              {previewOn
                ? "You're previewing the signed-in nav, but this page reads and writes your real account data — it needs an actual sign-in, not the preview toggle."
                : "Password, email, phone number, and notification preferences live on your free account. Create one to get started."}
            </p>
            <Link className="btn btn-primary btn-block" href={`/signup?next=${encodeURIComponent("/profile#address-team")}`}>
              Sign Up Free
            </Link>
            <Link
              className="btn btn-ghost btn-block"
              href={`/login?next=${encodeURIComponent("/profile#address-team")}`}
              style={{ marginTop: "0.6rem" }}
            >
              Already Have an Account? Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-zoom">
      <header className="site-header">
        <h1 className="glow">YOUR PROFILE</h1>
        <p className="subtitle">
          {loadingProfile ? "// loading..." : `// account settings for ${profile?.first_name ?? "you"}`}
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: "1rem" }}
          onClick={handleSignOut}
        >
          Sign Out
        </button>
      </header>

      <div className="form-shell">
        <div className="form-panel" style={{ marginBottom: "1.5rem" }}>
          <h2>Appearance</h2>
          <p className="form-intro">
            Not everyone wants a black screen with falling code — make it yours.
          </p>

          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.06em",
                color: "var(--text-dim)",
                display: "block",
                marginBottom: "0.5rem",
              }}
            >
              Matrix Rain Effect
            </label>
            <div className="league-chips" style={{ justifyContent: "flex-start" }}>
              <button
                type="button"
                className={`league-chip ${!isLightTheme && profile?.matrix_rain_enabled !== false ? "active" : ""}`}
                disabled={isLightTheme}
                onClick={() => handleAppearanceChange("matrix_rain_enabled", true)}
              >
                Enabled
              </button>
              <button
                type="button"
                className={`league-chip ${isLightTheme || profile?.matrix_rain_enabled === false ? "active" : ""}`}
                disabled={isLightTheme}
                onClick={() => handleAppearanceChange("matrix_rain_enabled", false)}
              >
                Disabled
              </button>
            </div>
            {isLightTheme && (
              <p className="form-footer-note" style={{ textAlign: "left", marginTop: "0.5rem" }}>
                Rain requires Dark theme — switch back to Dark to re-enable it.
              </p>
            )}
          </div>

          <div>
            <label
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.06em",
                color: "var(--text-dim)",
                display: "block",
                marginBottom: "0.5rem",
              }}
            >
              Theme
            </label>
            <div className="league-chips" style={{ justifyContent: "flex-start" }}>
              <button
                type="button"
                className={`league-chip theme-pill-red ${(profile?.theme ?? "dark") === "dark" ? "active" : ""}`}
                onClick={() => handleAppearanceChange("theme", "dark")}
              >
                🔴 Red Pill
              </button>
              <button
                type="button"
                className={`league-chip theme-pill-blue ${profile?.theme === "light" ? "active" : ""}`}
                onClick={() => handleAppearanceChange("theme", "light")}
              >
                🔵 Blue Pill
              </button>
            </div>
          </div>
        </div>

        <div className="form-panel" style={{ marginBottom: "1.5rem" }}>
          <h2>Password</h2>
          <p className="form-intro">Change the password used to sign in.</p>
          <form className="form-grid" onSubmit={handleUpdatePassword}>
            <div className="field">
              <label htmlFor="new-password">New Password</label>
              <input
                type="password"
                id="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <input
                type="password"
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="field full">
              <button type="submit" className="btn btn-primary btn-block">
                Update Password
              </button>
            </div>
          </form>
        </div>

        <div className="form-panel" style={{ marginBottom: "1.5rem" }}>
          <h2>Notification Email</h2>
          <p className="form-intro">
            <strong>
              Your sign-in email is {profile?.email ?? user?.email} and can&apos;t be changed on this page.
            </strong>{" "}
            The address below is only where we send notifications and account updates — change it any time
            without affecting how you sign in. It starts out the same as your sign-in email.
          </p>
          <form className="form-grid" onSubmit={handleUpdateNotificationEmail}>
            <div className="field full">
              <label htmlFor="notification-email">Notification Email</label>
              <input
                type="email"
                id="notification-email"
                name="notificationEmail"
                defaultValue={profile?.notification_email ?? profile?.email ?? user?.email ?? ""}
              />
            </div>
            <div className="field full">
              <button type="submit" className="btn btn-primary btn-block">
                Save Notification Email
              </button>
            </div>
          </form>
        </div>

        <div className="form-panel" style={{ marginBottom: "1.5rem" }}>
          <h2>Cell Number</h2>
          <p className="form-intro">
            Verified by text message -- this is what text alerts (below) actually get sent to, not just
            whatever&apos;s typed in the field.
          </p>

          {cellIsVerifiedForCurrentInput && (
            <p className="form-footer-note cell-verified-note" style={{ textAlign: "left" }}>
              ✓ Verified Number
            </p>
          )}

          <form className="form-grid" onSubmit={cellOtpSent ? handleVerifyCellCode : handleSendCellCode}>
            <div className="field full">
              <label htmlFor="cell">Cell Number</label>
              <input
                type="tel"
                id="cell"
                className={cellIsVerifiedForCurrentInput ? "cell-input-verified" : ""}
                value={cellInput}
                onChange={(e) => {
                  setCellInput(e.target.value);
                  setCellOtpSent(false);
                  setCellNote("");
                }}
                placeholder={cellIsInternational ? "44 7911 123456" : "(555) 555-5555"}
              />
            </div>

            <div className="checkbox-row">
              <input
                type="checkbox"
                id="cell-international"
                checked={cellIsInternational}
                onChange={(e) => {
                  setCellIsInternational(e.target.checked);
                  setCellOtpSent(false);
                  setCellNote("");
                }}
              />
              <label htmlFor="cell-international">
                International Number
                <span className="sub">
                  {cellIsInternational
                    ? "Enter just the digits, country code first -- we'll add the + for you."
                    : "Check this if the number above isn't a U.S. number."}
                </span>
              </label>
            </div>

            {cellOtpSent && (
              <div className="field full">
                <label htmlFor="cell-otp">Verification Code</label>
                <input
                  type="text"
                  id="cell-otp"
                  inputMode="numeric"
                  value={cellOtpCode}
                  onChange={(e) => setCellOtpCode(e.target.value)}
                  placeholder="Enter the 6-digit code"
                />
              </div>
            )}

            {cellNote && (
              <p className="form-footer-note" style={{ textAlign: "left" }}>
                {cellNote}
              </p>
            )}

            <div className="field full">
              <button type="submit" className="btn btn-primary btn-block">
                {cellOtpSent ? "Verify Code" : cellIsVerifiedForCurrentInput ? "Send New Code" : "Send Verification Code"}
              </button>
            </div>
          </form>
        </div>

        <div className="form-panel" id="address-team">
          <h2>Address &amp; Team Notifications</h2>
          <p className="form-intro">Mailing address, favorite teams, and text alerts.</p>
          {!loadingProfile && (
            <form className="form-grid" onSubmit={handleUpdateProfile}>
              <div className="field full">
                <label htmlFor="address">
                  Address <span className="optional-tag">(optional)</span>
                </label>
                <input type="text" id="address" name="address" defaultValue={profile?.address ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="city">
                  City <span className="optional-tag">(optional)</span>
                </label>
                <input type="text" id="city" name="city" defaultValue={profile?.city ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="state">
                  State <span className="optional-tag">(optional)</span>
                </label>
                <input type="text" id="state" name="state" maxLength={2} defaultValue={profile?.state ?? ""} />
              </div>
              <div className="field full">
                <label htmlFor="zip">
                  Zip Code <span className="optional-tag">(optional)</span>
                </label>
                <input type="text" id="zip" name="zip" defaultValue={profile?.zip ?? ""} />
              </div>
              <div className="checkbox-row">
                <input type="checkbox" id="notify" name="notify" defaultChecked={profile?.notify_win_prob ?? false} />
                <label htmlFor="notify">
                  Notify me when a selected team&apos;s win probability changes
                  <span className="sub">Requires a verified cell number (see the Cell Number section above).</span>
                </label>
              </div>
              <div className="field full">
                <button type="submit" className="btn btn-primary btn-block">
                  Save Preferences
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="form-panel" id="favorite-nfl-team" style={{ marginTop: "1.5rem" }}>
          <h2>Favorite NFL Team</h2>
          <p className="form-intro">One team, or none -- shown on your dashboard.</p>
          {favoriteTeam === null ? (
            <p className="profile-pill-empty">No preference set.</p>
          ) : (
            <div className="profile-pill-list">
              <span className="profile-pill">
                {favoriteTeamLabel ? teamLabel(favoriteTeamLabel) : favoriteTeam}
              </span>
            </div>
          )}
          <button
            type="button"
            className="favorites-empty-pill"
            onClick={() => setFavoriteTeamPickerOpen(true)}
          >
            + {favoriteTeam === null ? "Add Favorite Team" : "Edit Favorite Team"}
          </button>
          {favoriteTeamNote && (
            <p className="form-footer-note form-footer-note-save" style={{ marginTop: "1rem" }}>
              {favoriteTeamNote}
            </p>
          )}
        </div>

        <div className="form-panel" id="favorite-nba-team" style={{ marginTop: "1.5rem" }}>
          <h2>Favorite NBA Team</h2>
          <p className="form-intro">One team, or none -- shown on your dashboard.</p>
          {favoriteNbaTeam === null ? (
            <p className="profile-pill-empty">No preference set.</p>
          ) : (
            <div className="profile-pill-list">
              <span className="profile-pill">
                {favoriteNbaTeamLabel ? teamLabel(favoriteNbaTeamLabel) : favoriteNbaTeam}
              </span>
            </div>
          )}
          <button
            type="button"
            className="favorites-empty-pill"
            onClick={() => setFavoriteNbaTeamPickerOpen(true)}
          >
            + {favoriteNbaTeam === null ? "Add Favorite Team" : "Edit Favorite Team"}
          </button>
          {favoriteNbaTeamNote && (
            <p className="form-footer-note form-footer-note-save" style={{ marginTop: "1rem" }}>
              {favoriteNbaTeamNote}
            </p>
          )}
        </div>

        <div className="form-panel" id="notify-teams" style={{ marginTop: "1.5rem" }}>
          <h2>Teams to Notify Me About</h2>
          <p className="form-intro">
            Any number of NFL teams -- requires a verified cell number (see the Cell Number section above).
          </p>
          {notifyTeams.length === 0 ? (
            <p className="profile-pill-empty">No teams selected yet.</p>
          ) : (
            <div className="profile-pill-list">
              {notifyTeams.map((id) => {
                const t = TEAMS.find((t) => t.alias === id);
                return (
                  <span key={id} className="profile-pill">
                    {t ? teamLabel(t) : id}
                  </span>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className="favorites-empty-pill"
            onClick={() => setNotifyTeamsPickerOpen(true)}
          >
            + {notifyTeams.length === 0 ? "Add Teams to Notify" : "Edit Teams to Notify"}
          </button>
          {notifyTeamsNote && (
            <p className="form-footer-note form-footer-note-save" style={{ marginTop: "1rem" }}>
              {notifyTeamsNote}
            </p>
          )}
        </div>

        <div className="form-panel" id="my-bookies" style={{ marginTop: "1.5rem" }}>
          <h2>My Bookies</h2>
          <p className="form-intro">
            Pick the sportsbooks you actually have accounts at, so parlays and prop picks only ever show
            books you can act on.
          </p>
          {selectedBooks.length === 0 ? (
            <p className="profile-pill-empty">No sportsbooks selected yet.</p>
          ) : (
            <div className="profile-pill-list">
              {selectedBooks.map((id) => {
                const book = SPORTSBOOKS.find((b) => b.id === id);
                return (
                  <span key={id} className="profile-pill">
                    {book?.name ?? id}
                  </span>
                );
              })}
            </div>
          )}
          <button type="button" className="favorites-empty-pill" onClick={() => setBookPickerOpen(true)}>
            + {selectedBooks.length === 0 ? "Add Sportsbooks" : "Edit Sportsbooks"}
          </button>
          {bookiesNote && (
            <p className="form-footer-note form-footer-note-save" style={{ marginTop: "1rem" }}>
              {bookiesNote}
            </p>
          )}
        </div>

        <div className="form-panel" id="odds-preference" style={{ marginTop: "1.5rem" }}>
          <h2>Site Odds Preference</h2>
          <p className="form-intro">Choose how odds are displayed across the site.</p>
          <div className="odds-format-row">
            {ODDS_FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`odds-format-pill${oddsFormat === f.id ? " active" : ""}`}
                aria-pressed={oddsFormat === f.id}
                onClick={() => handleOddsFormatChange(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {oddsFormatNote && (
            <p className="form-footer-note form-footer-note-save" style={{ marginTop: "1rem" }}>
              {oddsFormatNote}
            </p>
          )}
        </div>

        <SportsbookPickerModal
          open={bookPickerOpen}
          selected={selectedBooks}
          onToggle={toggleBook}
          onDone={handleSaveBookies}
          coinBooksEnabled={coinBooksEnabled}
          onCoinBooksToggle={toggleCoinBooks}
        />

        <PillPickerModal
          open={favoriteTeamPickerOpen}
          title="Select Your Favorite NFL Team"
          options={nflTeamOptions}
          selected={favoriteTeam ? [favoriteTeam] : []}
          multiple={false}
          onToggle={toggleFavoriteTeam}
          onDone={handleSaveFavoriteTeam}
        />

        <PillPickerModal
          open={favoriteNbaTeamPickerOpen}
          title="Select Your Favorite NBA Team"
          options={nbaTeamOptions}
          selected={favoriteNbaTeam ? [favoriteNbaTeam] : []}
          multiple={false}
          onToggle={toggleFavoriteNbaTeam}
          onDone={handleSaveFavoriteNbaTeam}
        />

        <PillPickerModal
          open={notifyTeamsPickerOpen}
          title="Select Teams to Notify Me About"
          options={nflTeamOptions}
          selected={notifyTeams}
          multiple
          onToggle={toggleNotifyTeam}
          onDone={handleSaveNotifyTeams}
        />

        {saveNote && (
          <p className="form-footer-note form-footer-note-save" style={{ marginTop: "1.5rem" }}>
            {saveNote}
          </p>
        )}
      </div>
    </main>
  );
}
