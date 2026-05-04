// RES-29 — Per-entry export (.md, .txt, styled PDF).
//
// All three formats run client-side. Markdown and plain text are derived from
// the stored page model so page boundaries are preserved as `---` separators.
// PDF rasterizes the same handwriting + per-character jitter that the on-screen
// pages use, by mounting an offscreen DOM tree styled like PageSurface and
// snapshotting each page with html2canvas before assembling them into a
// jsPDF document. html2canvas + jspdf are dynamically imported so they only
// land in the bundle when the user actually exports.

import type { Entry } from "./storage";
import type { Page } from "./text";

// Visual constants mirrored from components/PageSurface.tsx and lib/scene.ts.
// Duplicated rather than imported because lib/ is consumed by Node tests that
// can't resolve the "@/components" alias, and the components tree imports
// browser-only Framer Motion. The numbers are stable; if they drift the PDF
// will look wrong, which is easy to spot in review.
const PAGE_WIDTH_PX = 520;
const PAGE_HEIGHT_PX = 673;
const WRITING_MARGIN_X = 56;
const WRITING_MARGIN_Y = 72;
const TEXT_FONT_FAMILY =
  "var(--font-caveat), Caveat, 'Kalam', cursive";
const TEXT_FONT_SIZE = 26;
const TEXT_LINE_HEIGHT = 1.85;
const LINE_HEIGHT_PX = Math.round(TEXT_FONT_SIZE * TEXT_LINE_HEIGHT);
const PAGE_BG =
  "linear-gradient(180deg, #faf4e4 0%, #f4ecd8 60%, #ede2c6 100%)";
const INK_COLOR = "#1b1712";

function pagesToText(pages: Page[]): string {
  return pages
    .map((page) =>
      page.lines.map((line) => line.chars.map((c) => c.char).join("")).join("\n"),
    )
    .join("\n\n---\n\n");
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so the browser has actually started the download. Same-tick
  // revoke can race in some browsers and cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filenameFor(entry: Entry, ext: string): string {
  return `morning-pages-${entry.date}.${ext}`;
}

export function exportText(entry: Entry, ext: "md" | "txt"): void {
  const body = pagesToText(entry.pages);
  const mime = ext === "md" ? "text/markdown" : "text/plain";
  const blob = new Blob([body], { type: `${mime};charset=utf-8` });
  triggerDownload(blob, filenameFor(entry, ext));
}

// Build an offscreen DOM tree that visually matches PageSurface (handwriting
// font + per-character jitter on a cream paper rectangle) so html2canvas can
// snapshot each page individually. Returns the container plus a list of the
// per-page elements; the caller is responsible for calling cleanup() once the
// snapshots are taken.
function buildOffscreenPages(pages: Page[]): {
  container: HTMLDivElement;
  pageEls: HTMLDivElement[];
  cleanup: () => void;
} {
  const container = document.createElement("div");
  // Push fully off-screen rather than display:none — html2canvas needs a real
  // layout, and a hidden subtree gives it 0×0 dimensions. Negative offset is
  // the standard trick.
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.style.pointerEvents = "none";

  const pageEls: HTMLDivElement[] = [];
  for (const page of pages) {
    const pageEl = document.createElement("div");
    pageEl.style.width = `${PAGE_WIDTH_PX}px`;
    pageEl.style.height = `${PAGE_HEIGHT_PX}px`;
    pageEl.style.padding = `${WRITING_MARGIN_Y}px ${WRITING_MARGIN_X}px`;
    pageEl.style.boxSizing = "border-box";
    pageEl.style.background = PAGE_BG;
    pageEl.style.fontFamily = TEXT_FONT_FAMILY;
    pageEl.style.fontSize = `${TEXT_FONT_SIZE}px`;
    pageEl.style.lineHeight = String(TEXT_LINE_HEIGHT);
    pageEl.style.color = INK_COLOR;
    pageEl.style.whiteSpace = "nowrap";
    pageEl.style.overflow = "hidden";

    for (const line of page.lines) {
      const lineEl = document.createElement("div");
      lineEl.style.minHeight = `${LINE_HEIGHT_PX}px`;
      for (const c of line.chars) {
        const span = document.createElement("span");
        span.style.display = "inline-block";
        span.style.transform = `translate(${c.offsetX}px, ${c.offsetY}px) rotate(${c.rotation}deg)`;
        // Match PageSurface's space handling so glyph-level transforms don't
        // collapse literal " " in inline-block flow.
        span.textContent = c.char === " " ? " " : c.char;
        lineEl.appendChild(span);
      }
      pageEl.appendChild(lineEl);
    }

    container.appendChild(pageEl);
    pageEls.push(pageEl);
  }

  document.body.appendChild(container);
  return {
    container,
    pageEls,
    cleanup: () => container.remove(),
  };
}

// Best-effort wait for the Caveat web font to be ready before snapshotting,
// so the PDF doesn't fall back to the system cursive face. document.fonts is
// available in all evergreen browsers; we still guard for older paths.
async function ensureFontsReady(): Promise<void> {
  const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } })
    .fonts;
  if (fonts?.ready) {
    try {
      await fonts.ready;
    } catch {
      // ignore — fall through to render with whatever's loaded
    }
  }
}

export async function exportPdf(entry: Entry): Promise<void> {
  if (entry.pages.length === 0) return;

  // Lazy-load the heavy deps so the journal route doesn't pay for them
  // on first paint.
  const [{ default: html2canvas }, jspdfMod] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const { jsPDF } = jspdfMod;

  await ensureFontsReady();

  const { pageEls, cleanup } = buildOffscreenPages(entry.pages);

  try {
    // Letter (8.5×11 in) matches the on-desk page proportions. Portrait, with
    // jsPDF working in points (72 per inch).
    const pdf = new jsPDF({
      unit: "pt",
      format: "letter",
      orientation: "portrait",
    });
    const pageWidthPt = pdf.internal.pageSize.getWidth();
    const pageHeightPt = pdf.internal.pageSize.getHeight();

    // Center the snapshot on the PDF page with a small breathing margin.
    // Aspect ratio of the source matches the PDF, so we just scale-to-fit
    // by width.
    const marginPt = 18;
    const drawWidth = pageWidthPt - marginPt * 2;
    const drawHeight = (drawWidth * PAGE_HEIGHT_PX) / PAGE_WIDTH_PX;
    const offsetY = (pageHeightPt - drawHeight) / 2;

    for (let i = 0; i < pageEls.length; i++) {
      const canvas = await html2canvas(pageEls[i], {
        // 2× for crisp text without ballooning file size. html2canvas reads
        // computed styles so the live --font-caveat variable applies here.
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(
        dataUrl,
        "JPEG",
        marginPt,
        offsetY,
        drawWidth,
        drawHeight,
        undefined,
        "FAST",
      );
    }

    pdf.save(filenameFor(entry, "pdf"));
  } finally {
    cleanup();
  }
}
