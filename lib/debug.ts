// Temporary dev affordance — URL-driven animation slow-mo.
//
// `?slow=4` multiplies animation durations by 4 so page turns (and anything
// else that opts in) can be watched frame-by-frame without a screen recorder.
// Intended for iterating on choreography, not a user-facing feature; remove
// call sites once the motion work settles.

export function getSlowMultiplier(): number {
  if (typeof window === "undefined") return 1;
  const raw = new URLSearchParams(window.location.search).get("slow");
  if (!raw) return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// RES-40 — dev affordances for A/B-ing the soft-wrap measurement strategy.
//
// `?measure=legacy` forces the old per-keystroke offscreen re-measure
// (measureLineWidth) so the pre-fix cost can be reproduced on the shipped
// build; anything else (default) uses the cheap real-cursor read.
// `?perf=1` makes the soft-wrap effect log {strategy, lineLen, ms} per
// keystroke so the cost can be watched in the console without DevTools.
// Both are dev-only — remove the call sites in app/page.tsx once RES-40 is
// verified and signed off.
export type MeasureStrategy = "cursor" | "legacy";

export function getMeasureStrategy(): MeasureStrategy {
  if (typeof window === "undefined") return "cursor";
  const raw = new URLSearchParams(window.location.search).get("measure");
  return raw === "legacy" ? "legacy" : "cursor";
}

export function perfEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("perf") === "1";
}
