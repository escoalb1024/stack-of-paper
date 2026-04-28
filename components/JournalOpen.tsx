// RES-25 — Journal open state with index + entry view.
//
// Fullscreen overlay rendered on top of the desk while `mode === JOURNAL_OPEN`.
// Laid out as an open book: left page holds the dated index, right page renders
// the selected entry with the same handwriting font + per-character jitter that
// the writing view uses, so reading a past entry feels like turning back to it
// in the same notebook. v1 per spec — book-flip animation between entries is v2.

"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  LINE_HEIGHT_PX,
  TEXT_FONT_FAMILY,
  TEXT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
} from "./PageSurface";
import type { Entry } from "@/lib/storage";
import type { Page } from "@/lib/text";

type JournalOpenProps = {
  entries: Entry[];
  onClose: () => void;
};

// Parse as local date (not UTC) to avoid off-by-one on dates near midnight.
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatEntryDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Renders the stored pages of an entry with the same char-level jitter +
// handwriting font used in the writing view. Lines are pre-wrapped in the
// stored model, so we keep `whiteSpace: nowrap` to preserve the exact breaks.
function EntryPages({ pages }: { pages: Page[] }) {
  return (
    <div
      style={{
        fontFamily: TEXT_FONT_FAMILY,
        fontSize: TEXT_FONT_SIZE,
        lineHeight: TEXT_LINE_HEIGHT,
        color: "#1b1712",
      }}
    >
      {pages.map((page, pi) => (
        <div key={pi}>
          {page.lines.map((line, li) => (
            <div
              key={li}
              style={{ minHeight: LINE_HEIGHT_PX, whiteSpace: "nowrap" }}
            >
              {line.chars.map((c, ci) => (
                <span
                  key={ci}
                  style={{
                    display: "inline-block",
                    transform: `translate(${c.offsetX}px, ${c.offsetY}px) rotate(${c.rotation}deg)`,
                  }}
                >
                  {c.char === " " ? " " : c.char}
                </span>
              ))}
            </div>
          ))}
          {pi < pages.length - 1 && (
            <div
              aria-hidden
              style={{
                margin: "18px 0 22px",
                borderBottom: "1px dashed rgba(40,25,10,0.18)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function JournalOpen({ entries, onClose }: JournalOpenProps) {
  // User's explicit pick, or null when they haven't chosen. The effective
  // selection (below) falls back to the newest entry so the default view
  // shows something useful without needing a sync effect. Holding the raw
  // pick separately keeps the fallback re-derivable as `entries` changes —
  // e.g. when the list loads after first paint.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selected =
    entries.find((e) => e.id === pickedId) ?? entries[0] ?? null;
  const selectedId = selected?.id ?? null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background:
          "radial-gradient(ellipse at 50% 50%, #3a3026 0%, #1e1813 80%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        type="button"
        aria-label="Close journal"
        onClick={onClose}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-100/40"
        style={{
          position: "absolute",
          top: 24,
          right: 28,
          width: 36,
          height: 36,
          borderRadius: 18,
          background: "rgba(255,255,255,0.05)",
          color: "rgba(255,240,220,0.75)",
          fontSize: 22,
          lineHeight: 1,
          cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        ×
      </button>

      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
        style={{
          display: "flex",
          width: "min(1200px, 92vw)",
          height: "min(760px, 86vh)",
          filter:
            "drop-shadow(0 8px 16px rgba(0,0,0,0.4)) drop-shadow(0 30px 60px rgba(0,0,0,0.32))",
        }}
      >
        {/* Left page — index */}
        <div
          style={{
            flex: 1,
            background:
              "linear-gradient(90deg, #f4ecd8 0%, #faf4e4 60%, #ede2c6 100%)",
            borderTopLeftRadius: 6,
            borderBottomLeftRadius: 6,
            boxShadow: "inset -14px 0 22px -14px rgba(50,30,10,0.35)",
            padding: "56px 36px 56px 64px",
            overflowY: "auto",
            fontFamily: TEXT_FONT_FAMILY,
            position: "relative",
          }}
        >
          <h1
            style={{
              color: "#2a1f12",
              fontSize: 46,
              marginBottom: 24,
              lineHeight: 1,
            }}
          >
            Journal
          </h1>
          {entries.length === 0 ? (
            <p style={{ color: "#7a6851", fontSize: 24 }}>
              No entries yet — finish a morning and add it to the journal.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {entries.map((e) => {
                const isSel = e.id === selectedId;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setPickedId(e.id)}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-800/30"
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 14px",
                        marginBottom: 4,
                        fontFamily: TEXT_FONT_FAMILY,
                        fontSize: 26,
                        color: isSel ? "#2a1f12" : "#5c4b36",
                        background: isSel
                          ? "rgba(90,60,30,0.1)"
                          : "transparent",
                        border: "none",
                        borderLeft: isSel
                          ? "3px solid #5a3c1e"
                          : "3px solid transparent",
                        borderRadius: 2,
                        cursor: "pointer",
                        lineHeight: 1.3,
                      }}
                    >
                      {formatEntryDate(e.id)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Spine shadow — the gutter between the two pages. */}
        <div
          aria-hidden
          style={{
            width: 8,
            background:
              "linear-gradient(90deg, rgba(30,18,6,0.55) 0%, rgba(30,18,6,0.15) 50%, rgba(30,18,6,0.55) 100%)",
          }}
        />

        {/* Right page — selected entry */}
        <div
          style={{
            flex: 1,
            background:
              "linear-gradient(90deg, #ede2c6 0%, #faf4e4 40%, #f4ecd8 100%)",
            borderTopRightRadius: 6,
            borderBottomRightRadius: 6,
            boxShadow: "inset 14px 0 22px -14px rgba(50,30,10,0.35)",
            padding: "56px 64px 56px 36px",
            overflowY: "auto",
          }}
        >
          {selected ? (
            // Keying on the entry id remounts the content so the fade-in
            // replays when switching entries. Simple cross-fade per the v1
            // spec (book-flip transition is v2).
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div
                style={{
                  fontFamily: TEXT_FONT_FAMILY,
                  color: "#7a6851",
                  fontSize: 22,
                  marginBottom: 24,
                  letterSpacing: 0.5,
                }}
              >
                {formatShortDate(selected.id)}
              </div>
              <EntryPages pages={selected.pages} />
            </motion.div>
          ) : (
            <div
              style={{
                fontFamily: TEXT_FONT_FAMILY,
                color: "#7a6851",
                fontSize: 24,
                marginTop: 80,
                textAlign: "center",
              }}
            >
              {entries.length === 0
                ? "Your past pages will live here."
                : "Select an entry to read it."}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
