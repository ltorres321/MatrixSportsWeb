"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMemberPreview } from "@/lib/useMemberPreview";
import { TEAMS } from "@/lib/teams";

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
  notify_win_prob: boolean;
  notify_teams: string[];
  theme: "dark" | "light";
  matrix_rain_enabled: boolean;
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
  const [cellOtpSent, setCellOtpSent] = useState(false);
  const [cellOtpCode, setCellOtpCode] = useState("");
  const [cellNote, setCellNote] = useState("");

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
        setLoadingProfile(false);
      });
  }, [isRealMember, user]);

  // A verified cell is only trustworthy for whatever number Supabase
  // actually confirmed via OTP -- if the field's since been edited to
  // something else (not yet sent/verified), that badge has to go away
  // even though the DB still says cell_verified until the new number
  // is confirmed.
  const cellIsVerifiedForCurrentInput =
    !!profile?.cell_verified && profile?.cell === cellInput && cellInput.trim() !== "";

  async function handleSendCellCode(e: FormEvent) {
    e.preventDefault();
    const trimmed = cellInput.trim();
    if (!trimmed) {
      setCellNote("Enter a cell number first.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ phone: trimmed });
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
    const trimmed = cellInput.trim();
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone: trimmed,
      token: cellOtpCode.trim(),
      type: "phone_change",
    });
    if (error) {
      setCellNote(error.message);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ cell: trimmed, cell_verified: true })
      .eq("id", user.id);

    setCellOtpSent(false);
    setCellOtpCode("");
    if (profileError) {
      setCellNote(profileError.message);
      return;
    }
    setProfile((prev) => (prev ? { ...prev, cell: trimmed, cell_verified: true } : prev));
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
      favorite_team: (String(formData.get("favoriteTeam") ?? "").trim() || null) as string | null,
      notify_win_prob: formData.get("notify") === "on",
      notify_teams: formData.getAll("notifyTeams").map(String),
    };

    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    setSaveNote(error ? error.message : "Preferences saved.");
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  }

  const isLightTheme = (profile?.theme ?? "dark") === "light";

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
            <Link className="btn btn-primary btn-block" href="/signup">
              Sign Up Free
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
                className={`league-chip ${(profile?.theme ?? "dark") === "dark" ? "active" : ""}`}
                onClick={() => handleAppearanceChange("theme", "dark")}
              >
                Dark
              </button>
              <button
                type="button"
                className={`league-chip ${profile?.theme === "light" ? "active" : ""}`}
                onClick={() => handleAppearanceChange("theme", "light")}
              >
                Light
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
            <p className="form-footer-note" style={{ textAlign: "left", color: "var(--green)" }}>
              ✓ Verified
            </p>
          )}

          <form className="form-grid" onSubmit={cellOtpSent ? handleVerifyCellCode : handleSendCellCode}>
            <div className="field full">
              <label htmlFor="cell">Cell Number</label>
              <input
                type="tel"
                id="cell"
                value={cellInput}
                onChange={(e) => {
                  setCellInput(e.target.value);
                  setCellOtpSent(false);
                  setCellNote("");
                }}
                placeholder="(555) 555-5555"
              />
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
                  placeholder="123456"
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

        <div className="form-panel">
          <h2>Address &amp; Team Notifications</h2>
          <p className="form-intro">Mailing address, favorite team, and text alerts.</p>
          {!loadingProfile && (
            <form className="form-grid" onSubmit={handleUpdateProfile}>
              <div className="field full">
                <label htmlFor="address">Address</label>
                <input type="text" id="address" name="address" defaultValue={profile?.address ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="city">City</label>
                <input type="text" id="city" name="city" defaultValue={profile?.city ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="state">State</label>
                <input type="text" id="state" name="state" maxLength={2} defaultValue={profile?.state ?? ""} />
              </div>
              <div className="field full">
                <label htmlFor="zip">Zip Code</label>
                <input type="text" id="zip" name="zip" defaultValue={profile?.zip ?? ""} />
              </div>
              <div className="field full">
                <label htmlFor="favoriteTeam">Favorite Team</label>
                <select id="favoriteTeam" name="favoriteTeam" defaultValue={profile?.favorite_team ?? ""}>
                  <option value="">No preference</option>
                  {TEAMS.map((t) => (
                    <option key={t.alias} value={t.alias}>
                      {t.market} {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="checkbox-row">
                <input type="checkbox" id="notify" name="notify" defaultChecked={profile?.notify_win_prob ?? false} />
                <label htmlFor="notify">
                  Notify me when a selected team&apos;s win probability changes
                  <span className="sub">Requires a verified cell number (see the Cell Number section above).</span>
                </label>
              </div>
              <div className="field full">
                <label>
                  Teams to Notify Me About <span className="optional-tag">(select any number)</span>
                </label>
                <div className="team-checklist">
                  {TEAMS.map((t) => (
                    <label key={t.alias} className="team-checklist-item">
                      <input
                        type="checkbox"
                        name="notifyTeams"
                        value={t.alias}
                        defaultChecked={profile?.notify_teams?.includes(t.alias) ?? false}
                      />
                      {t.market} {t.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field full">
                <button type="submit" className="btn btn-primary btn-block">
                  Save Preferences
                </button>
              </div>
            </form>
          )}
        </div>

        {saveNote && (
          <p className="form-footer-note" style={{ marginTop: "1.5rem" }}>
            {saveNote}
          </p>
        )}
      </div>
    </main>
  );
}
