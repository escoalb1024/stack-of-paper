// RES-34 — FSM tests covering the transitions introduced with arrow-key
// page navigation. Covers the ZOOM_OUT resting behavior (no auto-return
// to DESK_IDLE) and the PAGE_NAV sub-state.

import { test } from "node:test";
import assert from "node:assert/strict";
import { reducer, type AppState } from "./state.ts";

function run(start: AppState, actions: Parameters<typeof reducer>[1][]) {
  return actions.reduce<AppState>((s, a) => reducer(s, a), start);
}

test("ZOOM_OUT no longer auto-returns to DESK_IDLE on ZOOM_OUT_COMPLETE", () => {
  const after = reducer("ZOOM_OUT", { type: "ZOOM_OUT_COMPLETE" });
  assert.equal(after, "ZOOM_OUT");
});

test("ZOOM_OUT stays ZOOM_OUT across unrelated actions", () => {
  const after = run("ZOOM_OUT", [
    { type: "ESC_PRESSED" },
    { type: "PAGE_FILLED" },
    { type: "NAV_COMPLETE" },
  ]);
  assert.equal(after, "ZOOM_OUT");
});

test("ZOOM_OUT → CLICK_PAGE_STACK → ZOOM_IN (resume)", () => {
  assert.equal(reducer("ZOOM_OUT", { type: "CLICK_PAGE_STACK" }), "ZOOM_IN");
});

test("ZOOM_OUT → NAV_START → PAGE_NAV → NAV_COMPLETE → ZOOM_OUT", () => {
  const nav = reducer("ZOOM_OUT", { type: "NAV_START" });
  assert.equal(nav, "PAGE_NAV");
  assert.equal(reducer(nav, { type: "NAV_COMPLETE" }), "ZOOM_OUT");
});

test("PAGE_NAV ignores unrelated actions", () => {
  for (const a of [
    { type: "ESC_PRESSED" },
    { type: "CLICK_PAGE_STACK" },
    { type: "NAV_START" },
    { type: "PAGE_FILLED" },
  ] as const) {
    assert.equal(reducer("PAGE_NAV", a), "PAGE_NAV");
  }
});

test("NAV_START only fires from ZOOM_OUT", () => {
  for (const s of [
    "DESK_IDLE",
    "ZOOM_IN",
    "WRITING",
    "PAGE_TURN",
    "JOURNAL_OPEN",
  ] as const) {
    assert.equal(reducer(s, { type: "NAV_START" }), s);
  }
});
