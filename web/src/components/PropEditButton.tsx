"use client";

// "Line Edit" (user, 2026-11-15): per-leg button on a parlay card that
// lets a signed-in user try a different odds/line/over-under on that one
// pick. Saves to public.user_prop_edits (sql/018) via the browser
// Supabase client -- RLS scopes every row to auth.uid(), same pattern as
// the profile page's My Bookies picker. Never writes to any site-derived
// table: ParlayCard.tsx/NbaParlayCard.tsx apply the saved edit purely as
// a display overlay on their next render (router.refresh() re-runs the
// server page, which re-reads user_prop_edits).
//
// "Apply To" toggle (user, 2026-11-15): "I noticed the edit changes all
// instances of the prop ... on the edit create a toggle this bet only or
// all props." The same pick can be a leg in several parlay tiles within
// one scope -- pickKeyAll is the key that always meant (shared across
// every tile), pickKeyTile is scoped to just the ONE tile this button
// lives on (see propEditMath.ts's buildTileEditKey). Default is "This
// Bet Only" per the user's own spec ("Default is one prop the prop they
// change").
//
// The toggle is MUTUALLY EXCLUSIVE, not layered: saving always deletes
// the other key's row for this same pick, so exactly one edit (tile or
// all) governs it afterward. First shipped as additive (only "all" saves
// cleared the tile row) -- the user hit this directly: "edited prop line
// to all but could not get back to Only this bet after the fact," because
// the old "all" row survived a later "This Bet Only" save and kept
// overriding every other tile using that pick, so switching back
// appeared to do nothing.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EditScope } from "@/lib/propEditMath";

export interface PropEditButtonProps {
  pickKeyAll: string;
  pickKeyTile: string;
  // Whatever's CURRENTLY displayed for this leg -- the original
  // site-derived values when nothing's edited yet, or the active edit's
  // own values otherwise (resolveSavedEdit), so reopening the editor
  // shows what's actually there instead of resetting to the original.
  currentLine: number;
  currentSide: "over" | "under";
  currentOdds: number;
  hasEdit: boolean;
  // Which key the active edit (if any) is actually stored under --
  // null when hasEdit is false. Seeds the toggle's starting position so
  // reopening an edited leg doesn't silently flip its scope.
  activeScope: EditScope | null;
}

export function PropEditButton({
  pickKeyAll,
  pickKeyTile,
  currentLine,
  currentSide,
  currentOdds,
  hasEdit,
  activeScope,
}: PropEditButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(String(currentLine));
  const [side, setSide] = useState<"over" | "under">(currentSide);
  const [odds, setOdds] = useState(String(currentOdds));
  const [scope, setScope] = useState<EditScope>(activeScope ?? "tile");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setLine(String(currentLine));
    setSide(currentSide);
    setOdds(String(currentOdds));
    setScope(activeScope ?? "tile");
    setError(null);
    setOpen(true);
  }

  async function save() {
    const parsedLine = Number(line);
    const parsedOdds = Number(odds);
    if (!Number.isFinite(parsedLine)) {
      setError("Enter a valid line.");
      return;
    }
    if (!Number.isFinite(parsedOdds) || parsedOdds === 0 || (parsedOdds > -100 && parsedOdds < 100)) {
      setError("Enter valid American odds (e.g. -110 or +150).");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Sign in to save edits.");
      setSaving(false);
      return;
    }
    const targetKey = scope === "tile" ? pickKeyTile : pickKeyAll;
    const { error: upsertError } = await supabase.from("user_prop_edits").upsert(
      {
        user_id: userData.user.id,
        pick_key: targetKey,
        edited_line: parsedLine,
        edited_side: side,
        edited_odds: parsedOdds,
      },
      { onConflict: "user_id,pick_key" }
    );
    if (upsertError) {
      setSaving(false);
      setError(upsertError.message);
      return;
    }
    // The toggle is authoritative, not additive: whichever scope you
    // just saved is the ONLY edit left for this pick afterward, so the
    // other key always gets cleared (user, 2026-11-15: picked "All", then
    // "could not get back to Only this bet after the fact" -- the old
    // "all" row was surviving a later "This Bet Only" save and kept
    // overriding every other tile, so switching back visibly did
    // nothing). Without this, "This Bet Only" could leave a stale "all"
    // row still governing every other tile, and "All" could leave a
    // stale tile row still outranking it on the one tile you edited it
    // from (see resolveSavedEdit's tile-first precedence).
    const otherKey = scope === "all" ? pickKeyTile : pickKeyAll;
    await supabase.from("user_prop_edits").delete().eq("user_id", userData.user.id).eq("pick_key", otherKey);
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function clearEdit() {
    if (!activeScope) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const keyToClear = activeScope === "tile" ? pickKeyTile : pickKeyAll;
      const { error: deleteError } = await supabase
        .from("user_prop_edits")
        .delete()
        .eq("user_id", userData.user.id)
        .eq("pick_key", keyToClear);
      if (deleteError) {
        setSaving(false);
        setError(deleteError.message);
        return;
      }
    }
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={`prop-edit-btn${hasEdit ? " prop-edit-btn-active" : ""}`}
        onClick={openModal}
        title="Try a different odds, line, or over/under for this pick -- your view only, doesn't change site records."
      >
        {hasEdit ? "Edited" : "Edit"}
      </button>
      {open && (
        <div className="prop-edit-overlay" role="dialog" aria-modal="true" onClick={() => !saving && setOpen(false)}>
          <div className="prop-edit-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Edit This Pick</h3>
            <p className="prop-edit-note">
              Changes your own view only -- the site&apos;s own records and grading always use the original line.
            </p>
            <label className="prop-edit-field">
              Apply To
              <div className="prop-edit-side-toggle">
                <button type="button" className={scope === "tile" ? "active" : ""} onClick={() => setScope("tile")}>
                  This Bet Only
                </button>
                <button type="button" className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>
                  All Matching Props
                </button>
              </div>
              <span className="prop-edit-scope-hint">
                {scope === "tile"
                  ? "Only this parlay slip changes."
                  : "Every parlay using this same pick changes too."}
              </span>
            </label>
            <label className="prop-edit-field">
              Side
              <div className="prop-edit-side-toggle">
                <button type="button" className={side === "over" ? "active" : ""} onClick={() => setSide("over")}>
                  Over
                </button>
                <button type="button" className={side === "under" ? "active" : ""} onClick={() => setSide("under")}>
                  Under
                </button>
              </div>
            </label>
            <label className="prop-edit-field">
              Line
              <input type="number" step="0.5" value={line} onChange={(e) => setLine(e.target.value)} />
            </label>
            <label className="prop-edit-field">
              Odds
              <input type="number" step="1" value={odds} onChange={(e) => setOdds(e.target.value)} />
            </label>
            {error && <p className="prop-edit-error">{error}</p>}
            <div className="prop-edit-actions">
              {hasEdit && (
                <button type="button" className="btn btn-ghost" onClick={clearEdit} disabled={saving}>
                  Reset to Original
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
