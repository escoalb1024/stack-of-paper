// Film-grain overlay for the desk (RES-6).
// SVG <feTurbulence> noise at low opacity, fixed full-viewport, pointer-events none.
// Static seed for v1 — no animation.

export function GrainOverlay() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full mix-blend-multiply opacity-[0.18]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="desk-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          seed="7"
          stitchTiles="stitch"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.18
                  0 0 0 0 0.14
                  0 0 0 0 0.10
                  0 0 0 0.55 0"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#desk-grain)" />
    </svg>
  );
}
