"use client";

import { useEffect } from "react";

// Flips RainCanvas (mounted once in the root layout -- no direct prop
// channel from a leaf page's own data, see its own comment) to its
// gold palette while this component is mounted. RainCanvas re-reads
// this attribute on every draw() tick rather than once per effect, so
// there's no mount-ordering race between this effect and its own.
// Cleans the attribute up on unmount so navigating away reverts to
// the normal green rain immediately.
export default function GoldRainTrigger() {
  useEffect(() => {
    document.body.dataset.rainTier = "gold";
    return () => {
      delete document.body.dataset.rainTier;
    };
  }, []);
  return null;
}
