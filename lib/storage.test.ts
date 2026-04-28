// RES-21 — storage helper tests. Pure-function coverage only; idb-keyval
// itself is verified in-browser.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEntry,
  derivePlainText,
  entryKey,
  shouldPromoteDraft,
  todayISO,
  type Entry,
} from "./storage.ts";
import { initialTextState, textReducer, type TextState } from "./text.ts";

function typeString(state: TextState, s: string): TextState {
  let next = state;
  for (const ch of s) {
    next = textReducer(next, { type: "APPEND_CHAR", char: ch });
  }
  return next;
}

test("todayISO formats local YYYY-MM-DD", () => {
  // Explicit date; Date ctor with Y,M,D lands at local midnight.
  const d = new Date(2026, 3, 13); // April 13, 2026
  assert.equal(todayISO(d), "2026-04-13");
});

test("entryKey prefixes the date", () => {
  assert.equal(entryKey("2026-04-13"), "entry:2026-04-13");
});

test("derivePlainText joins lines and pages", () => {
  let s = typeString(initialTextState, "hello");
  s = textReducer(s, { type: "NEWLINE" });
  s = typeString(s, "world");
  s = textReducer(s, { type: "NEWLINE" });
  s = typeString(s, "second page");
  // Split so "second page" lands on page 2.
  const split = textReducer(s, { type: "ADD_PAGE", splitAt: 2 });
  assert.equal(derivePlainText(split.pages), "hello\nworld\n\nsecond page");
});

test("buildEntry preserves createdAt and status from existing entry", () => {
  const typed = typeString(initialTextState, "hi");
  const first = buildEntry("2026-04-13", typed.pages);
  assert.equal(first.status, "draft");
  assert.equal(first.id, "2026-04-13");

  const bumped = typeString(typed, "!");
  // Simulate: existing entry was marked journaled between saves.
  const existing = { ...first, status: "journaled" as const };
  const second = buildEntry("2026-04-13", bumped.pages, existing);
  assert.equal(second.createdAt, first.createdAt);
  assert.equal(second.status, "journaled");
  assert.ok(second.updatedAt >= first.updatedAt);
  assert.equal(second.plainText, "hi!");
});

test("shouldPromoteDraft promotes yesterday's draft but not today's", () => {
  const base: Omit<Entry, "date" | "status"> = {
    id: "x",
    pages: [],
    plainText: "",
    createdAt: 0,
    updatedAt: 0,
  };
  const today = "2026-04-23";
  assert.equal(
    shouldPromoteDraft({ ...base, date: "2026-04-22", status: "draft" }, today),
    true,
  );
  assert.equal(
    shouldPromoteDraft({ ...base, date: today, status: "draft" }, today),
    false,
  );
  assert.equal(
    shouldPromoteDraft(
      { ...base, date: "2026-04-22", status: "journaled" },
      today,
    ),
    false,
  );
  // Defensive: an entry dated in the future (clock skew, travel) shouldn't
  // be promoted.
  assert.equal(
    shouldPromoteDraft({ ...base, date: "2026-04-24", status: "draft" }, today),
    false,
  );
});

test("HYDRATE replaces pages and lands pageIndex on the last page", () => {
  const seed = typeString(initialTextState, "line one");
  const withSecondPage = textReducer(
    textReducer(seed, { type: "NEWLINE" }),
    { type: "ADD_PAGE", splitAt: 1 },
  );
  const hydrated = textReducer(initialTextState, {
    type: "HYDRATE",
    pages: withSecondPage.pages,
  });
  assert.equal(hydrated.pages.length, 2);
  assert.equal(hydrated.pageIndex, 1);
});

test("HYDRATE with empty pages is a no-op", () => {
  const hydrated = textReducer(initialTextState, { type: "HYDRATE", pages: [] });
  assert.equal(hydrated, initialTextState);
});
