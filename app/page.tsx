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
import { PageCountIndicator } from "@/components/PageCountIndicator";
import { PageNavAnimation } from "@/components/PageNavAnimation";
import { PageStack } from "@/components/PageStack";
import { PageTurnAnimation } from "@/components/PageTurnAnimation";
import {
  MAX_LINES_PER_PAGE,
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

  // RES-34: index of the page the user is reviewing while zoomed out. Only
  // meaningful in ZOOM_OUT / PAGE_NAV — the page actually rendered on the
  // active slot is derived at render time (see displayedPageIndex below), so
  // during writing this value can sit stale without affecting anything. We
  // reset it to textState.pageIndex at review boundaries (Esc from WRITING,
  // CLICK_PAGE_STACK from ZOOM_OUT) in the event handlers themselves, which
  // avoids a set-state-in-effect sync hook.
  const [viewingPageIndex, setViewingPageIndex] = useState(0);

  // RES-34: direction of the in-flight page-nav animation. null outside of
  // PAGE_NAV. Drives which easing/choreography PageNavAnimation plays.
  const [navDir, setNavDir] = useState<"next" | "prev" | null>(null);

  // RES-34: the page index actually shown on the active slot. During review
  // it's whatever page the user has arrow-keyed to; otherwise it tracks the
  // write-active page. Derived so PageSurface (and its cursorRef) stay bound
  // to the write-active page during WRITING without any syncing hook.
  const displayedPageIndex =
    mode === "ZOOM_OUT" || mode === "PAGE_NAV"
      ? viewingPageIndex
      : textState.pageIndex;


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

  // RES-17: page-fill detection. When the active page's line count exceeds
  // the page's line capacity, split off the overflow onto a fresh page and
  // transition the FSM into PAGE_TURN. Runs after the RES-15 soft-wrap
  // effect above, so on the render where a wrap pushes us past the
  // threshold this fires and hands off to the FSM. Guarded on mode so we
  // don't re-dispatch while PAGE_TURN is already in flight.
  useLayoutEffect(() => {
    if (mode !== "WRITING") return;
    const page = activePage(textState);
    if (page.lines.length > MAX_LINES_PER_PAGE) {
      textDispatch({ type: "ADD_PAGE", splitAt: MAX_LINES_PER_PAGE });
      dispatch({ type: "PAGE_FILLED" });
    }
  }, [textState, mode]);

  // RES-17: detect line-count increases on the *active* page and bump the
  // RES-16 line-break counter so PenHand can trigger its lift animation.
  // Compared against a per-page baseline so a page turn (pageIndex change)
  // resets the baseline instead of firing a spurious line-break animation.
  // RES-18: also skip the bump when the new line pushes past the page's
  // capacity — that render is immediately followed by ADD_PAGE + PAGE_FILLED,
  // and we want the page-turn lift (not the line-break lift) to play for it.
  const prevPageIndexRef = useRef(0);
  useLayoutEffect(() => {
    const n = activePage(textState).lines.length;
    const pageChanged = textState.pageIndex !== prevPageIndexRef.current;
    if (
      !pageChanged &&
      n > prevLineCountRef.current &&
      n <= MAX_LINES_PER_PAGE
    ) {
      setLineBreakCount((c) => c + 1);
    }
    prevLineCountRef.current = n;
    prevPageIndexRef.current = textState.pageIndex;
  }, [textState]);

  // RES-18: PAGE_TURN completion is driven by PageTurnAnimation's
  // onAnimationComplete callback below. The pen's page-turn lift is
  // triggered inside PenHand from the `pageTurning` prop transition.

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
    // RES-34: displayedPageIndex can change the rendered page (and thus the
    // cursor ref's position) without a textState change, so it needs to be
    // a dep. Without this, resuming writing after review leaves the camera
    // briefly pointed at the reviewed page's last char.
  }, [textState, displayedPageIndex]);

  // Esc during WRITING → zoom out. RES-34: also seed viewingPageIndex to the
  // current write page so the reviewer lands on the tail, not wherever it was
  // left by the previous review session.
  useEffect(() => {
    if (mode !== "WRITING") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewingPageIndex(textState.pageIndex);
        dispatch({ type: "ESC_PRESSED" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, textState.pageIndex]);

  // RES-34: ← / → flip through the stack while in ZOOM_OUT. No-op when only
  // one page exists or when already at a boundary (no wrap). Dispatches
  // NAV_START to move the FSM into PAGE_NAV; PageNavAnimation's completion
  // callback below returns us to ZOOM_OUT. Arrow presses during PAGE_NAV are
  // ignored by construction (listener is scoped to ZOOM_OUT).
  useEffect(() => {
    if (mode !== "ZOOM_OUT") return;
    if (textState.pages.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && viewingPageIndex > 0) {
        e.preventDefault();
        setNavDir("prev");
        setViewingPageIndex(viewingPageIndex - 1);
        dispatch({ type: "NAV_START" });
      } else if (
        e.key === "ArrowRight" &&
        viewingPageIndex < textState.pages.length - 1
      ) {
        e.preventDefault();
        setNavDir("next");
        setViewingPageIndex(viewingPageIndex + 1);
        dispatch({ type: "NAV_START" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, viewingPageIndex, textState.pages.length]);

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
          <PageStack
            onClick={() => {
              // RES-34: snap review back to the tail before zooming in so
              // cursorRef re-mounts against the write-active page and the
              // camera targets the right spot on handoff.
              setViewingPageIndex(textState.pageIndex);
              dispatch({ type: "CLICK_PAGE_STACK" });
            }}
            doneCount={textState.pageIndex}
            showActive={mode !== "PAGE_TURN" && mode !== "PAGE_NAV"}
          />
          {/* RES-18/34: hide the live PageSurface during PAGE_TURN and
              PAGE_NAV so only the animation overlay is visible. Kept
              mounted (via opacity) so cursorRef remains measurable.
              displayedPageIndex tracks the write-active page during
              WRITING and the reviewed page during ZOOM_OUT, so the cursor
              measurement stays correct for WRITING without any sync hook. */}
          <div
            style={{
              opacity:
                mode === "PAGE_TURN" || mode === "PAGE_NAV" ? 0 : 1,
            }}
          >
            <PageSurface
              page={textState.pages[displayedPageIndex]}
              cursorRef={cursorRef}
            />
          </div>
          {mode === "PAGE_TURN" && textState.pageIndex > 0 && (
            <PageTurnAnimation
              outgoingPage={textState.pages[textState.pageIndex - 1]}
              incomingPage={activePage(textState)}
              doneIndex={textState.pageIndex - 1}
              onComplete={() => dispatch({ type: "PAGE_TURN_COMPLETE" })}
            />
          )}
          {mode === "PAGE_NAV" && navDir !== null && (
            <PageNavAnimation
              direction={navDir}
              outgoingPage={
                textState.pages[
                  navDir === "next"
                    ? viewingPageIndex - 1
                    : viewingPageIndex + 1
                ]
              }
              incomingPage={textState.pages[viewingPageIndex]}
              onComplete={() => {
                setNavDir(null);
                dispatch({ type: "NAV_COMPLETE" });
              }}
            />
          )}
          <PenHand
            cursorX={cursorPos.x}
            cursorY={cursorPos.y}
            visible={mode === "WRITING" || mode === "PAGE_TURN"}
            keystrokeCount={keystrokeCount}
            lineBreakCount={lineBreakCount}
            pageTurning={mode === "PAGE_TURN"}
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

      <PageCountIndicator
        current={displayedPageIndex + 1}
        total={textState.pages.length}
        visible={
          mode === "WRITING" ||
          mode === "PAGE_TURN" ||
          mode === "ZOOM_OUT" ||
          mode === "PAGE_NAV"
        }
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
