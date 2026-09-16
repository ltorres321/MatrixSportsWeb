"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

// A plain target="_blank" anchor opens a new TAB in every modern
// browser regardless of the target value -- there's no HTML attribute
// that forces a real separate window anymore. window.open() with a
// non-empty features string (width/height here) is what actually
// gets browsers to open a distinct popup window instead. href/target/
// rel stay on the <a> itself too, not just the onClick -- middle-click,
// right-click "open in new tab," and no-JS all still work normally;
// this only upgrades a plain left-click.
export default function ExternalWindowLink({
  href,
  children,
  ...rest
}: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer,width=1000,height=800");
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
