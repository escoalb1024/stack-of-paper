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
