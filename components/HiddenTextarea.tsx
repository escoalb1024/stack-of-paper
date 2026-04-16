// RES-9 — Hidden textarea that captures keyboard input while in WRITING.
//
// Offscreen + aria-hidden + value="" (stateless capture). We intercept
// keydown on printable chars, Enter, and Backspace and dispatch into the
// text reducer. The textarea itself never actually holds the document —
// that lives in TextState.

"use client";

import { useEffect, useRef } from "react";

type Props = {
  active: boolean;
  onChar: (ch: string) => void;
  onNewline: () => void;
  onBackspace: () => void;
};

export function HiddenTextarea({
  active,
  onChar,
  onNewline,
  onBackspace,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Focus when the app enters WRITING; blur on exit so zoomed-out shortcuts
  // (Esc window listener, future journal keys) aren't swallowed.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) el.focus();
    else el.blur();
  }, [active]);

  return (
    <textarea
      ref={ref}
      aria-hidden
      tabIndex={-1}
      value=""
      readOnly
      // We don't use onChange — all input is captured via keydown so we can
      // distinguish Enter/Backspace/printable cleanly.
      onKeyDown={(e) => {
        if (!active) return;
        // Let browser/system shortcuts pass through.
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        if (e.key === "Backspace") {
          e.preventDefault();
          onBackspace();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onNewline();
          return;
        }
        // `e.key.length === 1` catches printable characters across layouts
        // without having to enumerate them.
        if (e.key.length === 1) {
          e.preventDefault();
          onChar(e.key);
        }
      }}
      style={{
        position: "fixed",
        left: -9999,
        top: -9999,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
        // Prevent iOS/macOS autocorrect fuss if anyone does focus it.
        // (Props on <textarea> in React don't type these cleanly, so inline
        // style is the right place for the visual bits.)
      }}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
    />
  );
}
