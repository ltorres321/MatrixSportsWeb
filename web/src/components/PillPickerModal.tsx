"use client";

// Generic Add -> full-screen panel -> pills -> Done flow (profile page,
// 2026-11-13/14). Originally built as SportsbookPickerModal for "My
// Bookies"; generalized so the same interaction also backs Favorite
// NFL/NBA Team (single-select) and Teams to Notify (multi-select).
//
// This component doesn't itself enforce single- vs multi-select -- it
// just renders options.map(...) and calls onToggle(id) on click.
// `multiple` only changes the intro copy. The actual selection rule
// (replace-one vs. add/remove) lives in the parent's onToggle handler,
// since that's a one-line difference per caller and doesn't need a
// second modal implementation.
export interface PillOption {
  id: string;
  name: string;
}

interface PillPickerModalProps {
  open: boolean;
  title: string;
  options: PillOption[];
  selected: string[];
  multiple: boolean;
  onToggle: (id: string) => void;
  onDone: () => void;
  // Optional master gate (My Bookies' "coin based books" toggle, user
  // 2026-11-16: "create a toggle top right enble/disable coin based
  // Books if its disabled make fliff and sportzino greyed out so user
  // can not select books at all unless the enable coin site"). Any
  // option whose id is in gatedOptionIds renders disabled -- greyed out,
  // not clickable -- unless gateEnabled is true. Other PillPickerModal
  // callers (Favorite Team, Notify Teams) omit these four props
  // entirely and get the original, fully-ungated behavior; no gate row
  // renders without a gateLabel.
  gatedOptionIds?: string[];
  gateEnabled?: boolean;
  gateLabel?: string;
  onGateToggle?: () => void;
}

export function PillPickerModal({
  open,
  title,
  options,
  selected,
  multiple,
  onToggle,
  onDone,
  gatedOptionIds,
  gateEnabled,
  gateLabel,
  onGateToggle,
}: PillPickerModalProps) {
  if (!open) return null;

  return (
    <div
      className="pill-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pill-picker-title"
      onClick={onDone}
    >
      <div className="pill-picker-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pill-picker-header">
          <h3 id="pill-picker-title">{title}</h3>
          <div className="pill-picker-header-right">
            {gateLabel && (
              <button
                type="button"
                className={`parlay-toggle pill-picker-gate-toggle${gateEnabled ? " on" : ""}`}
                aria-pressed={!!gateEnabled}
                onClick={onGateToggle}
              >
                <span className="parlay-toggle-track">
                  <span className="parlay-toggle-thumb" />
                </span>
                {gateLabel}
              </button>
            )}
            <button type="button" className="pill-picker-close" aria-label="Close" onClick={onDone}>
              &times;
            </button>
          </div>
        </div>
        <p className="pill-picker-intro">
          {multiple
            ? "Select as many as you want."
            : "Select one -- tap your current pick again to clear it."}
        </p>
        <div className="pill-picker-grid">
          {options.map((option) => {
            const active = selected.includes(option.id);
            const gated = (gatedOptionIds?.includes(option.id) ?? false) && !gateEnabled;
            return (
              <button
                key={option.id}
                type="button"
                className={`pill-picker-option${active ? " active" : ""}${gated ? " pill-picker-option-disabled" : ""}`}
                aria-pressed={active}
                disabled={gated}
                title={gated ? "Turn on coin-based books above to select this one" : undefined}
                onClick={() => onToggle(option.id)}
              >
                {option.name}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary btn-block pill-picker-done" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
