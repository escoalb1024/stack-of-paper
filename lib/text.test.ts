// RES-15 — soft-wrap reducer + break-point tests. Runnable with
// `node --test lib/text.test.ts`. No DOM required; measure.ts's
// measureLineWidth is covered by the in-browser verification.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activePage,
  initialTextState,
  textReducer,
  type Line,
  type TextState,
} from "./text.ts";
import { pickWrapPoint } from "./measure.ts";

function typeString(state: TextState, s: string): TextState {
  let next = state;
  for (const ch of s) {
    next = textReducer(next, { type: "APPEND_CHAR", char: ch });
  }
  return next;
}

function lastLine(state: TextState): Line {
  const p = activePage(state);
  return p.lines[p.lines.length - 1];
}

test("WRAP_LINE splits the active line at breakAt", () => {
  const typed = typeString(initialTextState, "hello world");
  const wrapped = textReducer(typed, { type: "WRAP_LINE", breakAt: 6 });
  const lines = activePage(wrapped).lines;
  assert.equal(lines.length, 2);
  assert.equal(
    lines[0].chars.map((c) => c.char).join(""),
    "hello ",
    "space stays on the completed line",
  );
  assert.equal(lines[1].chars.map((c) => c.char).join(""), "world");
});

test("WRAP_LINE is a no-op when breakAt is out of range", () => {
  const typed = typeString(initialTextState, "abcdef");
  for (const breakAt of [-1, 0, 6, 7, 99]) {
    const wrapped = textReducer(typed, { type: "WRAP_LINE", breakAt });
    assert.equal(
      activePage(wrapped).lines.length,
      1,
      `breakAt=${breakAt} should not split`,
    );
    assert.equal(lastLine(wrapped).chars.length, 6);
  }
});

test("WRAP_LINE preserves per-character jitter values on both halves", () => {
  const typed = typeString(initialTextState, "foo bar");
  const originalChars = lastLine(typed).chars.slice();
  const wrapped = textReducer(typed, { type: "WRAP_LINE", breakAt: 4 });
  const [l0, l1] = activePage(wrapped).lines;
  assert.deepEqual(l0.chars, originalChars.slice(0, 4));
  assert.deepEqual(l1.chars, originalChars.slice(4));
});

test("WRAP_LINE targets the trailing line (not earlier lines)", () => {
  // NEWLINE first, then type on the new line, then wrap that.
  let s = textReducer(typeString(initialTextState, "first line"), {
    type: "NEWLINE",
  });
  s = typeString(s, "second line here");
  const wrapped = textReducer(s, { type: "WRAP_LINE", breakAt: 7 });
  const lines = activePage(wrapped).lines;
  assert.equal(lines.length, 3);
  assert.equal(
    lines[0].chars.map((c) => c.char).join(""),
    "first line",
    "earlier lines untouched",
  );
  assert.equal(lines[1].chars.map((c) => c.char).join(""), "second ");
  assert.equal(lines[2].chars.map((c) => c.char).join(""), "line here");
});

test("pickWrapPoint breaks after the last interior space", () => {
  const typed = typeString(initialTextState, "hello world foo");
  const breakAt = pickWrapPoint(lastLine(typed).chars);
  // "hello world " (12 chars) | "foo" → break at 12
  assert.equal(breakAt, 12);
});

test("pickWrapPoint falls back to char-level when there is no interior space", () => {
  const typed = typeString(initialTextState, "supercalifragilistic");
  const chars = lastLine(typed).chars;
  const breakAt = pickWrapPoint(chars);
  assert.equal(breakAt, chars.length - 1);
});

test("pickWrapPoint breaks past a trailing space (treats it as a boundary)", () => {
  const typed = typeString(initialTextState, "hello world ");
  const chars = lastLine(typed).chars;
  // Trailing space is excluded from the interior search; the prior space
  // (after "hello") is the wrap point.
  const breakAt = pickWrapPoint(chars);
  assert.equal(breakAt, 6);
  assert.equal(chars[breakAt - 1].char, " ");
});

test("ADD_PAGE splits the active page at splitAt and advances pageIndex", () => {
  // Build a page with 4 lines: line0, line1, line2, line3.
  let s = typeString(initialTextState, "line0");
  s = textReducer(s, { type: "NEWLINE" });
  s = typeString(s, "line1");
  s = textReducer(s, { type: "NEWLINE" });
  s = typeString(s, "line2");
  s = textReducer(s, { type: "NEWLINE" });
  s = typeString(s, "line3");

  const turned = textReducer(s, { type: "ADD_PAGE", splitAt: 3 });
  assert.equal(turned.pages.length, 2);
  assert.equal(turned.pageIndex, 1);
  assert.equal(turned.pages[0].lines.length, 3);
  assert.equal(turned.pages[1].lines.length, 1);
  assert.equal(
    turned.pages[1].lines[0].chars.map((c) => c.char).join(""),
    "line3",
    "trailing line moves to the new page intact",
  );
});

test("ADD_PAGE preserves CharData jitter on moved lines", () => {
  let s = typeString(initialTextState, "keep");
  s = textReducer(s, { type: "NEWLINE" });
  s = typeString(s, "move");
  const originalMoved = s.pages[0].lines[1].chars.slice();
  const turned = textReducer(s, { type: "ADD_PAGE", splitAt: 1 });
  assert.deepEqual(turned.pages[1].lines[0].chars, originalMoved);
});

test("ADD_PAGE is a no-op when splitAt is out of range", () => {
  let s = typeString(initialTextState, "only");
  for (const splitAt of [-1, 0, 1, 2, 99]) {
    const turned = textReducer(s, { type: "ADD_PAGE", splitAt });
    assert.equal(turned.pages.length, 1, `splitAt=${splitAt} should not add a page`);
    assert.equal(turned.pageIndex, 0);
  }
});

test("activePage follows pageIndex after ADD_PAGE", () => {
  let s = typeString(initialTextState, "a");
  s = textReducer(s, { type: "NEWLINE" });
  s = typeString(s, "b");
  const turned = textReducer(s, { type: "ADD_PAGE", splitAt: 1 });
  assert.equal(activePage(turned).lines[0].chars.map((c) => c.char).join(""), "b");
});

test("pickWrapPoint returns 0 for degenerate input", () => {
  assert.equal(pickWrapPoint([]), 0);
  const singleChar = typeString(initialTextState, "x");
  assert.equal(pickWrapPoint(lastLine(singleChar).chars), 0);
});
