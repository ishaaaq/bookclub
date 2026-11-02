/**
 * Book search, normalisation and caching (Open Library → `books`, README §3).
 *
 * The pure helpers at the top are unit-tested. Search hits Open Library through the
 * fetch cache; a book is written to `books` once, when someone checks in with it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

export interface BookCandidate {
  /** `books.id` when the book is already in the club's cache. */
  id?: string;
  openLibraryKey?: string;
  title: string;
  author?: string;
  coverUrl?: string;
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
}

const OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json";
const WORK_KEY = /^\/works\/OL\d+W$/;
export const MAX_QUERY = 100;

// ---------------------------------------------------------------------------
// Pure helpers

/** Trims, collapses whitespace and caps length. Returns null when there's nothing to search. */
export function normaliseQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
  return q.length >= 2 ? q : null;
}

export function coverUrl(coverId: number | undefined, size: "S" | "M" | "L" = "M"): string | undefined {
  return coverId && Number.isInteger(coverId) && coverId > 0
    ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
    : undefined;
}

export function normaliseDoc(doc: OpenLibraryDoc): BookCandidate | null {
  const title = doc.title?.replace(/\s+/g, " ").trim();
  if (!title) return null;
  const authors = (doc.author_name ?? []).map((a) => a.trim()).filter(Boolean);
  return {
    openLibraryKey: doc.key && WORK_KEY.test(doc.key) ? doc.key : undefined,
    title: title.slice(0, 300),
    author: authors.length ? authors.slice(0, 2).join(", ") : undefined,
    coverUrl: coverUrl(doc.cover_i),
  };
}

/** Normalises a search response, dropping untitled and duplicate works. */
export function normaliseSearch(json: unknown): BookCandidate[] {
  const docs = (json as { docs?: unknown })?.docs;
  if (!Array.isArray(docs)) return [];
  const seen = new Set<string>();
  const out: BookCandidate[] = [];
  for (const doc of docs as OpenLibraryDoc[]) {
    const book = normaliseDoc(doc);
    if (!book) continue;
    const key = book.openLibraryKey ?? `${book.title.toLowerCase()}|${book.author?.toLowerCase() ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(book);
  }
  return out;
}

/** Club books first (people in the room may be reading them), then Open Library results not already listed. */
export function mergeResults(club: BookCandidate[], remote: BookCandidate[], limit = 10): BookCandidate[] {
  // Same work, or same title and author (club books typed by hand have no key).
  const sameBook = (b: BookCandidate) => `${b.title.toLowerCase()}|${b.author?.toLowerCase() ?? ""}`;
  const keys = new Set(club.map((b) => b.openLibraryKey).filter(Boolean));
  const books = new Set(club.map(sameBook));
  const rest = remote.filter((b) => !(b.openLibraryKey && keys.has(b.openLibraryKey)) && !books.has(sameBook(b)));
  return [...club, ...rest].slice(0, limit);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COVER_URL = /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-[SML]\.jpg$/;

/**
 * Validates a book the browser sent back to the check-in action. Anything we can't vouch
 * for (odd keys, foreign cover URLs) is dropped rather than cached.
 */
export function parseCandidate(raw: unknown): BookCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : undefined;
  const title = str(r.title, 300);
  if (!title) return null;
  return {
    id: typeof r.id === "string" && UUID.test(r.id) ? r.id : undefined,
    openLibraryKey: typeof r.openLibraryKey === "string" && WORK_KEY.test(r.openLibraryKey) ? r.openLibraryKey : undefined,
    title,
    author: str(r.author, 200),
    coverUrl: typeof r.coverUrl === "string" && COVER_URL.test(r.coverUrl) ? r.coverUrl : undefined,
  };
}

/** Escapes LIKE wildcards so text matches literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** A "contains" pattern for a member's query. */
export function likePattern(q: string): string {
  return `%${escapeLike(q)}%`;
}

// ---------------------------------------------------------------------------
// I/O

export async function searchOpenLibrary(q: string, signal?: AbortSignal): Promise<BookCandidate[]> {
  const url = `${OPEN_LIBRARY_SEARCH}?${new URLSearchParams({
    q,
    fields: "key,title,author_name,cover_i",
    limit: "12",
  })}`;
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "Shelf (SBC Abuja book club app)" },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error(`Open Library search failed: ${res.status}`);
  return normaliseSearch(await res.json());
}

type Client = SupabaseClient<Database>;

export async function searchClubBooks(supabase: Client, q: string): Promise<BookCandidate[]> {
  const { data } = await supabase
    .from("books")
    .select("id, open_library_key, title, author, cover_url")
    .ilike("title", likePattern(q))
    .limit(4);
  return (data ?? []).map((b) => ({
    id: b.id,
    openLibraryKey: b.open_library_key ?? undefined,
    title: b.title,
    author: b.author ?? undefined,
    coverUrl: b.cover_url ?? undefined,
  }));
}

/** Club books plus Open Library. If Open Library is slow or down, members still get club books and the manual fallback. */
export async function searchBooks(supabase: Client, q: string): Promise<BookCandidate[]> {
  const [club, remote] = await Promise.all([
    searchClubBooks(supabase, q),
    searchOpenLibrary(q, AbortSignal.timeout(4000)).catch(() => []),
  ]);
  return mergeResults(club, remote);
}

/**
 * Returns the `books.id` for a candidate, writing it to the cache the first time. Needs the
 * service-role client: members can't write `books` directly.
 */
export async function cacheBook(service: Client, book: BookCandidate): Promise<string> {
  if (book.id) return book.id;
  const title = book.title.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!title) throw new Error("A book needs a title");
  const author = book.author?.replace(/\s+/g, " ").trim().slice(0, 200) || null;

  if (book.openLibraryKey) {
    // First write wins: a later check-in can't rewrite a cached book's title or cover.
    const { error } = await service
      .from("books")
      .upsert(
        { open_library_key: book.openLibraryKey, title, author, cover_url: book.coverUrl ?? null },
        { onConflict: "open_library_key", ignoreDuplicates: true },
      );
    if (error) throw error;
    const { data, error: readError } = await service
      .from("books")
      .select("id")
      .eq("open_library_key", book.openLibraryKey)
      .single();
    if (readError) throw readError;
    return data.id;
  }

  // Typed by hand: reuse an earlier hand-typed copy so the shelf groups them together.
  let existing = service.from("books").select("id").is("open_library_key", null).ilike("title", escapeLike(title));
  existing = author ? existing.ilike("author", escapeLike(author)) : existing.is("author", null);
  const { data: found } = await existing.limit(1).maybeSingle();
  if (found) return found.id;

  const { data, error } = await service.from("books").insert({ title, author }).select("id").single();
  if (error) throw error;
  return data.id;
}
