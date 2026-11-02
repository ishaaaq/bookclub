"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BookCover } from "@/components/BookCover";
import type { BookCandidate } from "@/lib/books";
import { checkIn } from "./actions";

// Name (first time only) → search → tap a cover. The whole check-in is one screen (< 15 s).
// On a dropped connection the check-in is kept in localStorage and sent when the phone is back online (F6).

type Pending = { name: string | null; book: BookCandidate };

function queueKey(token: string) {
  return `sbc-pending-checkin:${token}`;
}

function readQueue(token: string): Pending | null {
  try {
    const raw = localStorage.getItem(queueKey(token));
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

function writeQueue(token: string, pending: Pending | null) {
  try {
    if (pending) localStorage.setItem(queueKey(token), JSON.stringify(pending));
    else localStorage.removeItem(queueKey(token));
  } catch {
    // Private mode or storage full: the member can still tap again.
  }
}

export function CheckinForm({ token, needsName }: { token: string; needsName: boolean }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [queued, setQueued] = useState<Pending | null>(null);
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);

  const send = useCallback(
    (p: Pending) => {
      if (!navigator.onLine) {
        writeQueue(token, p);
        setQueued(p);
        return;
      }
      writeQueue(token, null);
      startTransition(async () => {
        try {
          const result = await checkIn(token, p.name, p.book);
          setQueued(null);
          if ("error" in result) setError(result.error);
          else router.push(result.shelfUrl);
        } catch {
          // The request never reached us: keep it and retry when the connection is back.
          writeQueue(token, p);
          setQueued(p);
        }
      });
    },
    [token, router],
  );

  // Retry a queued check-in on load and whenever the phone comes back online.
  useEffect(() => {
    const retry = () => {
      const p = readQueue(token);
      if (p) send(p);
    };
    const p = readQueue(token);
    if (p) {
      setQueued(p);
      if (navigator.onLine) send(p);
    }
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [token, send]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const json = (await res.json()) as { results: BookCandidate[] };
        setResults(json.results);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function submit(book: BookCandidate) {
    if (needsName && !name.trim()) {
      setError("Tell us your name first.");
      nameRef.current?.focus();
      return;
    }
    setError(null);
    send({ name: needsName ? name : null, book });
  }

  const input = "mt-1 block w-full rounded-lg border border-ink/20 bg-white px-3 py-3";

  return (
    <div className="space-y-5" aria-busy={pending}>
      {needsName && (
        <label className="block">
          <span className="text-sm text-ink-soft">Your name, as it&rsquo;ll appear on the shelf</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="given-name"
            className={input}
          />
        </label>
      )}

      {!manual ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-ink-soft">What are you reading?</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title or author"
              enterKeyHint="search"
              className={input}
            />
          </label>

          {searching && results.length === 0 && <p className="text-sm text-ink-soft">Searching…</p>}

          <ul className="divide-y divide-ink/10">
            {results.map((b) => (
              <li key={b.id ?? b.openLibraryKey ?? b.title}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit(b)}
                  className="flex w-full items-center gap-3 py-2 text-left disabled:opacity-50"
                >
                  <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} className="w-10" />
                  <span>
                    <span className="block font-serif">{b.title}</span>
                    {b.author && <span className="block text-sm text-ink-soft">{b.author}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button type="button" onClick={() => setManual(true)} className="text-sm text-binding underline">
            Can&rsquo;t find it? Type the title
          </button>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            submit({ title: String(data.get("title") ?? ""), author: String(data.get("author") ?? "") || undefined });
          }}
        >
          <label className="block">
            <span className="text-sm text-ink-soft">Title</span>
            <input name="title" required maxLength={300} defaultValue={query} className={input} />
          </label>
          <label className="block">
            <span className="text-sm text-ink-soft">Author (optional)</span>
            <input name="author" maxLength={200} className={input} />
          </label>
          <button disabled={pending} className="w-full rounded-lg bg-binding px-4 py-3 font-medium text-paper disabled:opacity-50">
            Check in
          </button>
          <button type="button" onClick={() => setManual(false)} className="text-sm text-binding underline">
            Back to search
          </button>
        </form>
      )}

      {pending && <p role="status" className="text-sm text-ink-soft">Checking you in…</p>}
      {queued && !pending && (
        <div role="status" className="space-y-2 rounded-lg bg-paper-deep p-4">
          <p>
            No signal right now. We&rsquo;ll check you in with <em>{queued.book.title}</em> as soon as you&rsquo;re back online. Keep this
            page open.
          </p>
          <button type="button" onClick={() => send(queued)} className="text-sm text-binding underline">
            Try now
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-binding">
          {error}
        </p>
      )}
    </div>
  );
}
