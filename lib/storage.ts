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

import { get, keys, set } from "idb-keyval";
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
// RES-22: previous-day drafts are auto-promoted to journaled on load so the
// work is preserved even when the user closed the tab without hitting
// "Add to Journal". Today's draft is left alone — the user may still be
// mid-session. Date strings are ISO (YYYY-MM-DD) so lexical comparison is
// equivalent to chronological.
export function shouldPromoteDraft(entry: Entry, today: string): boolean {
  return entry.status === "draft" && entry.date < today;
}

// Scan all stored entries and promote stale drafts (drafts dated before
// `today`) to journaled. Returns the dates that were promoted. Does not
// delete any entries — all previous work is preserved per RES-22.
export async function promoteStaleDrafts(today: string): Promise<string[]> {
  const allKeys = await keys();
  const promoted: string[] = [];
  for (const key of allKeys) {
    if (typeof key !== "string" || !key.startsWith(ENTRY_PREFIX)) continue;
    const entry = await get<Entry>(key);
    if (!entry || !shouldPromoteDraft(entry, today)) continue;
    const updated: Entry = {
      ...entry,
      status: "journaled",
      updatedAt: Date.now(),
    };
    await set(key, updated);
    promoted.push(entry.date);
  }
  return promoted;
}

// Count entries with status "journaled". Used by the closed-journal visual
// (RES-24) to show thickness based on how much has been written. Cheap enough
// to run on mount; the journal index (RES-25) will likely replace this with
// a full list query.
export async function countJournaledEntries(): Promise<number> {
  const allKeys = await keys();
  let count = 0;
  for (const key of allKeys) {
    if (typeof key !== "string" || !key.startsWith(ENTRY_PREFIX)) continue;
    const entry = await get<Entry>(key);
    if (entry?.status === "journaled") count++;
  }
  return count;
}

// List all journaled entries, newest first. Powers the journal index (RES-25).
// Drafts are intentionally excluded — the journal shows past entries, and any
// stale drafts from previous days will have been promoted by
// `promoteStaleDrafts` on mount, so the only remaining draft is today's
// in-progress entry (which lives on the desk, not in the journal).
export async function listJournaledEntries(): Promise<Entry[]> {
  const allKeys = await keys();
  const entries: Entry[] = [];
  for (const key of allKeys) {
    if (typeof key !== "string" || !key.startsWith(ENTRY_PREFIX)) continue;
    const entry = await get<Entry>(key);
    if (entry?.status === "journaled") entries.push(entry);
  }
  // ISO dates sort lexically; reverse for newest-first.
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return entries;
}

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
