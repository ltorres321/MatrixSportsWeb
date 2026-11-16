"use client";

import { SPORTSBOOKS, COIN_BASED_BOOK_IDS } from "@/lib/sportsbooks";
import { PillPickerModal } from "@/components/PillPickerModal";

// "My Bookies" picker (profile page) -- a thin wrapper around the
// generic PillPickerModal with this section's fixed title/option list.
// Multi-select: a user can have accounts at any number of books.
//
// coinBooksEnabled/onCoinBooksToggle back the "Coin Based Books" gate
// (user, 2026-11-16: "create a toggle top right enble/disable coin
// based Books if its disabled make fliff and sportzino greyed out so
// user can not select books at all unless the enable coin site") --
// profile/page.tsx owns the actual state (derived from whether the user
// already has a coin book selected; see that file's own comment).
interface SportsbookPickerModalProps {
  open: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onDone: () => void;
  coinBooksEnabled: boolean;
  onCoinBooksToggle: () => void;
}

export function SportsbookPickerModal({
  open,
  selected,
  onToggle,
  onDone,
  coinBooksEnabled,
  onCoinBooksToggle,
}: SportsbookPickerModalProps) {
  return (
    <PillPickerModal
      open={open}
      title="Select Your Sportsbooks"
      options={SPORTSBOOKS}
      selected={selected}
      multiple
      onToggle={onToggle}
      onDone={onDone}
      gatedOptionIds={COIN_BASED_BOOK_IDS}
      gateEnabled={coinBooksEnabled}
      gateLabel="Coin Based Books"
      onGateToggle={onCoinBooksToggle}
    />
  );
}
