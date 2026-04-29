// Morning Pages — root scene.
//
// Composes Desk (RES-6) + PageStack (RES-7) + PageSurface (RES-9) inside the
// CameraContainer driven by the mode FSM (RES-8). Text state lives in its
// own reducer (RES-9) so the mode FSM stays focused on transitions.

"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { AddToJournalButton } from "@/components/AddToJournalButton";
import { CameraContainer } from "@/components/CameraContainer";
import { Desk } from "@/components/Desk";
import { HiddenTextarea } from "@/components/HiddenTextarea";
import { JournalClosed } from "@/components/JournalClosed";
import { JournalOpen } from "@/components/JournalOpen";
import { JournalSlideAnimation } from "@/components/JournalSlideAnimation";
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
import { Toast } from "@/components/Toast";
import { measureLineWidth, pickWrapPoint } from "@/lib/measure";
import {
  PAGE_ACTIVE_LEFT,
  PAGE_ACTIVE_TOP,
  WRITING_MARGIN_X,
  WRITING_MARGIN_Y,
  WRITING_WIDTH,
} from "@/lib/scene";
import { initialState, reducer } from "@/lib/state";
import {
  activePage,
  initialTextState,
  isSeparatorPage,
  makeSeparatorPage,
  textReducer,
} from "@/lib/text";
import {
  buildEntry,
  countJournaledEntries,
  type Entry,
  listJournaledEntries,
  loadEntry,
  promoteStaleDrafts,
  saveEntry,
  todayISO,
} from "@/lib/storage";

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

  // RES-21: once a draft has been hydrated (or confirmed absent) we can
  // start autosaving. Gating avoids the first-render save clobbering a
  // saved entry before the HYDRATE dispatch lands.
  const [hydrated, setHydrated] = useState(false);
  const existingEntryRef = useRef<Awaited<ReturnType<typeof loadEntry>>>(undefined);
  const dateRef = useRef<string>(todayISO());

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

  // RES-28: toast visibility for the 3-page milestone. Fires once per entry
  // when the user crosses to their 4th page (pageIndex reaches 3 — i.e. 3
  // pages are done). milestoneShownRef guards against re-firing across
  // re-renders, hydration of an already-deep entry, or PAGE_NAV/ZOOM_OUT
  // round-trips. handleSlideComplete clears it so a new entry can re-arm.
  const [toastVisible, setToastVisible] = useState(false);
  const milestoneShownRef = useRef(false);

  // RES-24: count of journaled entries, drives the closed-journal thickness.
  // Loaded on mount alongside the stale-draft promotion so it reflects any
  // rollovers that just happened.
  const [journaledCount, setJournaledCount] = useState(0);

  // RES-25: journaled entries for the open-journal index. Loaded lazily when
  // the user opens the journal — keeping this out of the mount path means the
  // initial paint isn't blocked on enumerating every past entry.
  const [journalEntries, setJournalEntries] = useState<Entry[]>([]);

  // Where to return after closing the journal. The journal is openable from
  // both DESK_IDLE (fresh desk) and ZOOM_OUT (mid-session, draft visible on
  // desk); recording the source lets close return there rather than always
  // dropping back to DESK_IDLE and losing the in-progress view.
  const journalReturnRef = useRef<"DESK_IDLE" | "ZOOM_OUT">("DESK_IDLE");

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

  // RES-25: load journaled entries whenever the journal opens. Refreshing on
  // each open (rather than caching for the session) means entries added via
  // the "Add to Journal" flow in a prior browse cycle show up without a page
  // reload. Drafts are filtered out server-side so this list is always "past
  // entries".
  useEffect(() => {
    if (mode !== "JOURNAL_OPEN") return;
    let cancelled = false;
    (async () => {
      const list = await listJournaledEntries();
      if (cancelled) return;
      setJournalEntries(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // RES-25: Esc while the journal is open closes it back to DESK_IDLE. Scoped
  // to JOURNAL_OPEN so it doesn't conflict with the WRITING-mode Esc handler
  // above.
  useEffect(() => {
    if (mode !== "JOURNAL_OPEN") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")
        dispatch({ type: "CLOSE_JOURNAL", returnTo: journalReturnRef.current });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  // RES-21: on mount, load today's draft (if any) and hydrate textState.
  // RES-22: before loading, promote any stale drafts from previous days to
  // journaled so they're preserved even when the user closed without hitting
  // "Add to Journal". Runs exactly once — dateRef is stable and we don't want
  // to re-hydrate after the user has started typing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await promoteStaleDrafts(dateRef.current);
      if (cancelled) return;
      const existing = await loadEntry(dateRef.current);
      if (cancelled) return;
      if (existing && existing.pages.length > 0) {
        existingEntryRef.current = existing;
        // RES-36: when today's entry has already been journaled, leave the
        // desk fresh so the user can write a "second session" rather than
        // re-rendering the journaled content as a draft. The ref is still
        // preserved so handleAddToJournal can append to it.
        if (existing.status !== "journaled") {
          textDispatch({ type: "HYDRATE", pages: existing.pages });
        }
      }
      // RES-24: count after promotion so yesterday's just-promoted drafts are
      // reflected in the journal thickness on first paint.
      const count = await countJournaledEntries();
      if (cancelled) return;
      setJournaledCount(count);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // RES-21: debounced autosave. 500ms after the last textState change (once
  // hydrated) we persist the entry. A later save supersedes an in-flight
  // one thanks to the cleanup-driven timeout reset.
  // RES-23: once today's entry has been journaled, suppress further autosaves
  // to the same date key — they'd overwrite the journaled content. (Storing
  // a same-day "second session" as its own entry would need a non-date key;
  // out of scope for this ticket.) The check uses a ref read inside the
  // timeout so it always sees the latest status without re-subscribing.
  useEffect(() => {
    if (!hydrated) return;
    const handle = setTimeout(() => {
      if (existingEntryRef.current?.status === "journaled") return;
      const entry = buildEntry(
        dateRef.current,
        textState.pages,
        existingEntryRef.current,
      );
      existingEntryRef.current = entry;
      void saveEntry(entry);
    }, 500);
    return () => clearTimeout(handle);
  }, [hydrated, textState.pages]);

  // RES-28: trigger the 3-page toast when the active page index first reaches
  // 3 — i.e. immediately after the third page-turn lands the user on page 4.
  // Gated to WRITING/PAGE_TURN so HYDRATE (which runs during DESK_IDLE before
  // the user resumes) of a deep draft doesn't re-fire the milestone, and so
  // arrow-keying through pages in ZOOM_OUT/PAGE_NAV review doesn't trigger it.
  // The ref ensures one toast per entry; handleSlideComplete clears it.
  useEffect(() => {
    if (milestoneShownRef.current) return;
    if (mode !== "WRITING" && mode !== "PAGE_TURN") return;
    if (textState.pageIndex < 3) return;
    milestoneShownRef.current = true;
    setToastVisible(true);
    const handle = setTimeout(() => setToastVisible(false), 3000);
    return () => clearTimeout(handle);
  }, [mode, textState.pageIndex]);

  // RES-23: "Add to Journal" handler. Persists today's entry as journaled
  // before triggering the slide animation so the data is safe even if the
  // user navigates away mid-animation. Empty page stacks are no-ops on the
  // storage side but still play the animation harmlessly.
  const handleAddToJournal = async () => {
    const hasContent = textState.pages.some((p) =>
      p.lines.some((l) => l.chars.length > 0),
    );
    dispatch({ type: "CLICK_ADD_TO_JOURNAL" });
    if (hasContent) {
      const existing = existingEntryRef.current;
      // RES-36: if today's entry is already journaled, append the new pages
      // to the previously-journaled ones (with a visible "entry N" separator
      // page) instead of overwriting. The separator number is derived from
      // existing separators in the stored pages so the count stays correct
      // across multiple same-day additions.
      let pages = textState.pages;
      if (existing?.status === "journaled") {
        const additions = existing.pages.filter(isSeparatorPage).length;
        const entryNumber = additions + 2;
        pages = [
          ...existing.pages,
          makeSeparatorPage(entryNumber),
          ...textState.pages,
        ];
      }
      const base = buildEntry(dateRef.current, pages, existing);
      const journaled = { ...base, status: "journaled" as const };
      await saveEntry(journaled);
      existingEntryRef.current = journaled;
    }
  };

  // RES-23: JOURNAL_SLIDE animation finished. Reset the on-desk text to a
  // fresh page stack, re-query the journaled count from storage so the
  // closed-journal thickness reflects reality (covers the same-day re-journal
  // edge case where an optimistic bump would overcount), and advance the
  // FSM to DESK_IDLE.
  const handleSlideComplete = async () => {
    textDispatch({ type: "RESET" });
    setViewingPageIndex(0);
    // RES-28: re-arm the 3-page milestone for the next entry.
    milestoneShownRef.current = false;
    setToastVisible(false);
    dispatch({ type: "JOURNAL_SLIDE_COMPLETE" });
    const count = await countJournaledEntries();
    setJournaledCount(count);
  };

  return (
    <main className="relative h-screen w-screen overflow-clip bg-[#2a2621]">
      <CameraContainer
        state={mode}
        penX={cursorPos.x}
        penY={cursorPos.y}
        keystrokeCount={keystrokeCount}
        onZoomInComplete={() => dispatch({ type: "ZOOM_IN_COMPLETE" })}
        onZoomOutComplete={() => dispatch({ type: "ZOOM_OUT_COMPLETE" })}
      >
        <Desk>
          <JournalClosed
            entryCount={journaledCount}
            onClick={() => {
              journalReturnRef.current =
                mode === "ZOOM_OUT" ? "ZOOM_OUT" : "DESK_IDLE";
              dispatch({ type: "CLICK_JOURNAL" });
            }}
            interactive={mode === "DESK_IDLE" || mode === "ZOOM_OUT"}
          />
          {mode !== "JOURNAL_SLIDE" && (
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
          )}
          {mode === "JOURNAL_SLIDE" && (
            <JournalSlideAnimation
              doneCount={textState.pageIndex}
              onComplete={handleSlideComplete}
            />
          )}
          {/* RES-18/34: hide the live PageSurface during PAGE_TURN and
              PAGE_NAV so only the animation overlay is visible. Kept
              mounted (via opacity) so cursorRef remains measurable.
              displayedPageIndex tracks the write-active page during
              WRITING and the reviewed page during ZOOM_OUT, so the cursor
              measurement stays correct for WRITING without any sync hook.
              RES-23: also hide during JOURNAL_SLIDE so the rendered text
              doesn't ghost over the slide animation. */}
          <div
            style={{
              opacity:
                mode === "PAGE_TURN" ||
                mode === "PAGE_NAV" ||
                mode === "JOURNAL_SLIDE"
                  ? 0
                  : 1,
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
          {/* RES-23: in-scene "Add to Journal" affordance. Lives in
              desk-space so it sits on the desk surface alongside the page
              stack rather than floating in viewport chrome. Visibility is
              gated to ZOOM_OUT so it fades in once the camera settles and
              fades out as the slide animation begins. */}
          <AddToJournalButton
            visible={mode === "ZOOM_OUT"}
            onClick={handleAddToJournal}
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

      <Toast visible={toastVisible} message="3 pages done ✓" />

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

      {mode === "JOURNAL_OPEN" && (
        <JournalOpen
          entries={journalEntries}
          onClose={() =>
            dispatch({ type: "CLOSE_JOURNAL", returnTo: journalReturnRef.current })
          }
          onDelete={(id) => {
            setJournalEntries((curr) => curr.filter((e) => e.id !== id));
            void countJournaledEntries().then(setJournaledCount);
          }}
        />
      )}

      {/* Dev affordance — state + char count. Remove once the journal UI
          lands in later tickets. */}
      <div className="pointer-events-none fixed bottom-3 right-3 rounded bg-black/40 px-2 py-1 font-mono text-xs text-white/80">
        {mode}
        {mode === "WRITING" ? "  ·  Esc to zoom out" : null}
        {mode === "ZOOM_OUT" ? "  ·  click pages to resume, or Add to Journal" : null}
        {mode === "JOURNAL_OPEN" ? "  ·  Esc to close" : null}
      </div>
    </main>
  );
}
