// Morning Pages — root scene.
//
// Composes Desk (RES-6) + PageStack (RES-7) + PageSurface (RES-9) inside the
// CameraContainer driven by the mode FSM (RES-8). Text state lives in its
// own reducer (RES-9) so the mode FSM stays focused on transitions.

"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { CameraContainer } from "@/components/CameraContainer";
import { Desk } from "@/components/Desk";
import { HiddenTextarea } from "@/components/HiddenTextarea";
import { PageStack } from "@/components/PageStack";
import {
  PageSurface,
  TEXT_FONT_FAMILY,
  TEXT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
} from "@/components/PageSurface";
import { PenHand } from "@/components/PenHand";
import { measureLineWidth, pickWrapPoint } from "@/lib/measure";
import {
  PAGE_ACTIVE_LEFT,
  PAGE_ACTIVE_TOP,
  WRITING_MARGIN_X,
  WRITING_MARGIN_Y,
  WRITING_WIDTH,
} from "@/lib/scene";
import { initialState, reducer } from "@/lib/state";
import { activePage, initialTextState, textReducer } from "@/lib/text";

// Small horizontal nudge so the pen nib sits just to the right of the last
// character, as if hovering for the next one.
const PEN_LEAD_X = Math.round(TEXT_FONT_SIZE * 0.3);

// Default cursor position — writing origin in desk-space, at the text baseline.
const DEFAULT_CURSOR = {
  x: PAGE_ACTIVE_LEFT + WRITING_MARGIN_X + PEN_LEAD_X,
  y: PAGE_ACTIVE_TOP + WRITING_MARGIN_Y + TEXT_FONT_SIZE,
};

export default function Home() {
  const [mode, dispatch] = useReducer(reducer, initialState);
  const [textState, textDispatch] = useReducer(textReducer, initialTextState);

  // RES-12: keystroke counter drives pen jitter animation.
  const [keystrokeCount, setKeystrokeCount] = useState(0);

  // RES-16: line-break counter drives the pen lift animation. Bumped
  // whenever the active page grows a new line (NEWLINE or WRAP_LINE).
  const [lineBreakCount, setLineBreakCount] = useState(0);
  const prevLineCountRef = useRef(1);

  // RES-11: cursor marker ref + measured position in desk-space.
  const cursorRef = useRef<HTMLSpanElement>(null);
  const [cursorPos, setCursorPos] = useState(DEFAULT_CURSOR);

  // RES-15: after every text change, measure the active line and soft-wrap
  // if it overflows the writable area. Runs before paint so the user never
  // sees an overflowed state. Dispatching WRAP_LINE triggers a re-render and
  // a second pass of this effect, which will be a no-op once the new
  // trailing line fits.
  useLayoutEffect(() => {
    const page = activePage(textState);
    const line = page.lines[page.lines.length - 1];
    if (line.chars.length < 2) return;

    const width = measureLineWidth(line.chars, {
      fontFamily: TEXT_FONT_FAMILY,
      fontSize: TEXT_FONT_SIZE,
      lineHeight: TEXT_LINE_HEIGHT,
    });
    if (width <= WRITING_WIDTH) return;

    const breakAt = pickWrapPoint(line.chars);
    if (breakAt > 0) textDispatch({ type: "WRAP_LINE", breakAt });
  }, [textState]);

  // RES-16: detect line-count increases on the active page and bump the
  // counter so PenHand can trigger its lift animation. Covers both Enter
  // (NEWLINE) and soft-wrap (WRAP_LINE).
  useLayoutEffect(() => {
    const n = activePage(textState).lines.length;
    if (n > prevLineCountRef.current) setLineBreakCount((c) => c + 1);
    prevLineCountRef.current = n;
  }, [textState]);

  useLayoutEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    // offsetLeft is relative to the nearest positioned ancestor (PageSurface
    // container, which is position:absolute). offsetTop of the parent line div
    // gives the y within the writing area.
    const lineDiv = el.parentElement;
    if (!lineDiv) return;
    setCursorPos({
      x: PAGE_ACTIVE_LEFT + WRITING_MARGIN_X + el.offsetLeft + PEN_LEAD_X,
      y: PAGE_ACTIVE_TOP + WRITING_MARGIN_Y + lineDiv.offsetTop + TEXT_FONT_SIZE,
    });
  }, [textState]);

  // Esc during WRITING → zoom out.
  useEffect(() => {
    if (mode !== "WRITING") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "ESC_PRESSED" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  return (
    <main className="relative h-screen w-screen overflow-clip bg-[#2a2621]">
      <CameraContainer
        state={mode}
        penX={cursorPos.x}
        penY={cursorPos.y}
        onZoomInComplete={() => dispatch({ type: "ZOOM_IN_COMPLETE" })}
        onZoomOutComplete={() => dispatch({ type: "ZOOM_OUT_COMPLETE" })}
      >
        <Desk>
          <PageStack onClick={() => dispatch({ type: "CLICK_PAGE_STACK" })} />
          <PageSurface page={activePage(textState)} cursorRef={cursorRef} />
          <PenHand
            cursorX={cursorPos.x}
            cursorY={cursorPos.y}
            visible={mode === "WRITING"}
            keystrokeCount={keystrokeCount}
            lineBreakCount={lineBreakCount}
          />
        </Desk>
      </CameraContainer>

      <HiddenTextarea
        active={mode === "WRITING"}
        onChar={(ch) => {
          textDispatch({ type: "APPEND_CHAR", char: ch });
          setKeystrokeCount((c) => c + 1);
        }}
        onNewline={() => {
          textDispatch({ type: "NEWLINE" });
          setKeystrokeCount((c) => c + 1);
        }}
        onBackspace={() => {
          textDispatch({ type: "BACKSPACE" });
          setKeystrokeCount((c) => c + 1);
        }}
      />

      {/* Dev affordance — state + char count. Remove once the journal UI
          lands in later tickets. */}
      <div className="pointer-events-none fixed bottom-3 right-3 rounded bg-black/40 px-2 py-1 font-mono text-xs text-white/80">
        {mode}
        {mode === "WRITING" ? "  ·  Esc to zoom out" : null}
      </div>
    </main>
  );
}
