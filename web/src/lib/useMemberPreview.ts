"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";

const PREVIEW_KEY = "sw_preview_member";

// Real sign-in/sign-out is confirmed reliable now -- the "testing:
// toggle member view" button that drives this is hidden site-wide via
// this flag (see PredictionsView.tsx/GameDetailView.tsx). Left in
// (not deleted) in case it's needed again; flip to true to bring it
// back everywhere at once.
export const SHOW_MEMBER_PREVIEW_TOGGLE = false;

// Testing aid, like the old static site's "toggle member view" button
// -- but real auth exists now, so this only fakes the *visual* signed-
// in state (nav pill, unlocked slate). It never creates a real
// session, so pages that need real data (Profile) should still gate
// on isRealMember, not isMember, and explain why.
export function useMemberPreview() {
  const { user, loaded } = useUser();
  // Always starts false so server and first client render match --
  // reading localStorage in the initializer instead caused a
  // hydration mismatch (server never sees localStorage, client does).
  const [previewOn, setPreviewOn] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from a browser-only store (localStorage) after mount is exactly what this effect is for; the resulting re-render is expected, not a mismatch.
    setPreviewOn(localStorage.getItem(PREVIEW_KEY) === "true");
  }, []);

  function toggle() {
    setPreviewOn((prev) => {
      const next = !prev;
      localStorage.setItem(PREVIEW_KEY, String(next));
      return next;
    });
  }

  const isRealMember = !!user;

  return {
    isMember: isRealMember || previewOn,
    isRealMember,
    previewOn,
    toggle,
    loaded,
    user,
  };
}
