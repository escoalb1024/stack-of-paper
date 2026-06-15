// Shared scene geometry. The desk is a fixed 1920×1200 viewport canvas
// (RES-6 spec). Coordinates here are in desk space; CameraContainer
// scales/translates the whole thing into viewport space.
//
// RES-38 — scene is rendered at native zoom resolution (×RENDER_SCALE) so
// text rasterizes crisply during WRITING. The camera then displays the
// desk view at scale 1/RENDER_SCALE (downscaling stays sharp) and the
// zoomed view at scale 1 (1:1, no GPU bitmap stretch). All desk-space
// constants below incorporate RENDER_SCALE so components stay agnostic of
// the trick — they just lay out in "render-space px" as before.

// RES-38 — RENDER_SCALE governs how much larger the in-camera DOM is rendered
// vs. what's visible at desk view. Higher = sharper text at WRITING but
// quadratically more GPU work for transform animations (compositor layers
// are ~RENDER_SCALE² the original area). 1.25 trades most of the sharpness
// gain for animation smoothness (1.56× scene area vs. 1×) — camera springs
// and journal-hover animations stay fluid, text is still a touch crisper
// than the pre-refactor blur.
export const RENDER_SCALE = 1.25;

// RES-38 — mechanical helper for desk-space numeric literals inside
// in-camera components. `rs(6)` reads as "6 render-space px" and produces
// the value the component should actually use. Stick to this for every
// pixel-valued literal (positions, sizes, radii, shadow offsets) so the
// codebase has one clear convention. Don't wrap rotation degrees,
// opacities, durations, or unitless line-heights — those aren't lengths.
export const rs = (n: number) => n * RENDER_SCALE;

export const DESK_WIDTH = rs(1920);
export const DESK_HEIGHT = rs(1200);

// Paper — 8.5×11 proportions, scaled to a comfortable on-desk size.
export const PAGE_WIDTH = rs(520);
export const PAGE_HEIGHT = Math.round(PAGE_WIDTH * (11 / 8.5));

// Bottom-centered on the desk with breathing room underneath.
export const PAGE_BOTTOM_MARGIN = rs(90);
export const PAGE_ACTIVE_LEFT = Math.round((DESK_WIDTH - PAGE_WIDTH) / 2);
export const PAGE_ACTIVE_TOP =
  DESK_HEIGHT - PAGE_HEIGHT - PAGE_BOTTOM_MARGIN;

// Writing area insets on the active page. The cursor origin lives inside
// these margins; the camera (RES-13) tracks the live pen position rather
// than a fixed point on the page.
export const WRITING_MARGIN_X = rs(56);
export const WRITING_MARGIN_Y = rs(72);

// Writable interior — used by RES-15 soft-wrap to know when a line overflows
// and (once RES-16/17 land) when a page fills. Kept in desk-space px so the
// layout-time measurer can compare raw offsetWidth against it directly.
export const WRITING_WIDTH = PAGE_WIDTH - WRITING_MARGIN_X * 2;
export const WRITING_HEIGHT = PAGE_HEIGHT - WRITING_MARGIN_Y * 2;

// RES-40 — soft-wrap decision safety margin. The fast path reads the live
// cursor x (cursorRef.offsetLeft), which can under-report the true line width
// by a pixel or two (offsetLeft is integer-rounded) and ignores the cursive
// last-character ink overhang of the Caveat font. When the fast read lands
// within this margin of WRITING_WIDTH, the soft-wrap effect falls back to the
// exact offscreen measure so a line can't visibly overflow before it wraps
// (which otherwise also delays the dependent page-fill). ~1.5 character widths
// at the writing font size — wide enough to absorb the read discrepancy,
// narrow enough that the exact measure only runs for the last char or two.
export const WRAP_PROBE_MARGIN = rs(22);

// RES-38 — zoom maths.
// The scene is rendered at RENDER_SCALE; the camera multiplies by these
// scales to land each state at the correct viewport size.
// - ZOOM_SCALE = 1.8: visual zoom magnification of ~2.25× the base page
//   size. Trades a little closeness for tighter text — rasterized DOM is
//   at RENDER_SCALE (1.25×) and the GPU stretch at zoom is ~1.44×, so
//   text reads cleaner than at higher zooms while still feeling close
//   enough to write at.
// - deskViewScale(viewport): cover-fit the desk into the viewport, undoing
//   RENDER_SCALE in the process. Picks max(w/W, h/H) so the desk always
//   fills both axes (clipping the longer one), the same "cover" semantics
//   a CSS background uses. Computed at the camera so it stays in sync with
//   live viewport size — the desk no longer leaves dark bands at the edges
//   on monitors larger than the bare RENDER_SCALE downscale.
export const ZOOM_SCALE = 1.8;

export function deskViewScale(viewportW: number, viewportH: number): number {
  return Math.max(viewportW / DESK_WIDTH, viewportH / DESK_HEIGHT);
}
