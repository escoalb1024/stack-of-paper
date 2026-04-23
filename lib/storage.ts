// Morning Pages — IndexedDB persistence (RES-21).
//
// Each day's writing session is one Entry, keyed in IndexedDB by its ISO
// date ("YYYY-MM-DD") via `idb-keyval`. Autosave is caller-driven: the app
// effect debounces textState changes and calls saveEntry. On mount the app
// calls loadTodayEntry to resume a draft in progress.
//
// RES-22 (day rollover) and RES-25+ (journal browsing) will layer on top of
// the same keying: promote yesterday's draft to journaled on load, enumerate
// all keys for the journal index.

import { get, set } from "idb-keyval";
import type { Page } from "./text.ts";

export type EntryStatus = "draft" | "journaled";

export interface Entry {
  id: string;
  date: string;
  status: EntryStatus;
  pages: Page[];
  plainText: string;
  createdAt: number;
  updatedAt: number;
}

const ENTRY_PREFIX = "entry:";

export function entryKey(date: string): string {
  return `${ENTRY_PREFIX}${date}`;
}

// Local-date ISO (YYYY-MM-DD). Intentionally not UTC — "today" means the
// user's local day, so an entry started before midnight and saved after it
// stays grouped with the evening it began.
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function derivePlainText(pages: Page[]): string {
  return pages
    .map((page) =>
      page.lines.map((line) => line.chars.map((c) => c.char).join("")).join("\n"),
    )
    .join("\n\n");
}

export async function loadEntry(date: string): Promise<Entry | undefined> {
  return (await get<Entry>(entryKey(date))) ?? undefined;
}

export async function saveEntry(entry: Entry): Promise<void> {
  await set(entryKey(entry.id), entry);
}

// Build an Entry for persistence from in-memory pages. `existing` lets the
// caller preserve createdAt/status across saves within the same day.
export function buildEntry(
  date: string,
  pages: Page[],
  existing?: Entry,
): Entry {
  const now = Date.now();
  return {
    id: date,
    date,
    status: existing?.status ?? "draft",
    pages,
    plainText: derivePlainText(pages),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
