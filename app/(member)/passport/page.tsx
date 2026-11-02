import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { getChapter, getMember, getSchedule } from "@/lib/club";
import { formatDay } from "@/lib/format";
import { computeStreak, heldMeetupDates } from "@/lib/passport";
import { createClient } from "@/lib/supabase/server";
import { removeWantToRead, signOut, updateProfile } from "./actions";

// Reading passport (core loop): your meetups, the books you brought, your streak.

export default async function PassportPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const chapter = await getChapter(supabase);
  const member = await getMember(supabase, chapter.id);

  if (!member) {
    return (
      <div className="space-y-3">
        <h1 className="font-serif text-2xl">Your reading passport</h1>
        <p className="text-ink-soft">
          It starts the first time you check in with a book. Already have one?{" "}
          <Link href="/signin?next=/passport" className="text-binding underline">Sign in</Link>
        </p>
        <Link href="/" className="inline-block text-binding underline">See the next meetup</Link>
      </div>
    );
  }

  const [{ data: checkins }, { data: wants }, { data: today }, { config, overrides }] = await Promise.all([
    supabase
      .from("checkins")
      .select("id, meetup_id, meetups (date), books (id, title, author, cover_url)")
      .eq("member_id", member.id),
    supabase
      .from("want_to_read")
      .select("created_at, books (id, title, author, cover_url)")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("chapter_today", { p_chapter: chapter.id }),
    getSchedule(supabase, chapter, "0001-01-01"),
  ]);

  const visits = (checkins ?? [])
    .filter((c) => c.meetups && c.books)
    .map((c) => ({ id: c.id, meetupId: c.meetup_id, date: c.meetups!.date, book: c.books! }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const todayDate = today ?? visits[0]?.date ?? config.anchorDate;
  const streak = computeStreak(new Set(visits.map((v) => v.date)), heldMeetupDates(config, overrides, todayDate), todayDate);
  const bookIds = [...new Set(visits.map((v) => v.book.id))];

  const { data: counts } = bookIds.length
    ? await supabase.rpc("book_reader_counts", { p_chapter: chapter.id, p_books: bookIds })
    : { data: [] };
  const others = new Map((counts ?? []).map((c) => [c.book_id, c.readers - 1]));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-ink-soft">{chapter.name}</p>
        <h1 className="font-serif text-2xl">{member.display_name}&rsquo;s passport</h1>
      </header>

      {member.is_guest && (
        <p className="rounded-lg border border-binding/30 p-3 text-sm">
          You&rsquo;re a guest on this phone. <Link href="/signin?next=/passport" className="text-binding underline">Sign in</Link> to keep your
          passport if you change phones or clear your browser.
        </p>
      )}

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label={visits.length === 1 ? "meetup" : "meetups"} value={visits.length} />
        <Stat label={bookIds.length === 1 ? "book" : "books"} value={bookIds.length} />
        <Stat label="in a row" value={streak} />
      </dl>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Your meetups</h2>
        {visits.length === 0 ? (
          <p className="text-ink-soft">No check-ins yet. Scan the QR code at the next meetup.</p>
        ) : (
          <ul className="space-y-3">
            {visits.map((v) => {
              const n = others.get(v.book.id) ?? 0;
              return (
                <li key={v.id} className="flex gap-3">
                  <BookCover title={v.book.title} author={v.book.author} coverUrl={v.book.cover_url} className="w-12" />
                  <div className="min-w-0">
                    <Link href={`/shelf/${v.meetupId}`} className="text-sm text-ink-soft underline">
                      {formatDay(v.date, chapter.timezone)}
                    </Link>
                    <p className="font-serif leading-snug">{v.book.title}</p>
                    {v.book.author && <p className="text-sm text-ink-soft">{v.book.author}</p>}
                    {n > 0 && (
                      <p className="text-sm text-binding">
                        {n} {n === 1 ? "other member has" : "others in the club have"} brought this
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Want to read</h2>
        {!wants?.length ? (
          <p className="text-ink-soft">Spot something good on the shelf? Tap &ldquo;Want to read&rdquo; and it lands here.</p>
        ) : (
          <ul className="space-y-3">
            {wants.map(
              ({ books: b }) =>
                b && (
                  <li key={b.id} className="flex items-center gap-3">
                    <BookCover title={b.title} author={b.author} coverUrl={b.cover_url} className="w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="font-serif leading-snug">{b.title}</p>
                      {b.author && <p className="text-sm text-ink-soft">{b.author}</p>}
                    </div>
                    <form action={removeWantToRead}>
                      <input type="hidden" name="book_id" value={b.id} />
                      <button className="text-sm text-ink-soft underline" aria-label={`Remove ${b.title}`}>Remove</button>
                    </form>
                  </li>
                ),
            )}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">On the shelf</h2>
        <form action={updateProfile} className="space-y-3">
          <label className="block">
            <span className="text-sm text-ink-soft">Display name</span>
            <input
              name="display_name"
              defaultValue={member.display_name}
              maxLength={60}
              required
              className="mt-1 block w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            />
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="hide_from_shelf" defaultChecked={member.hide_from_shelf} className="mt-1 h-5 w-5 accent-binding" />
            <span>
              Hide me from the shelf
              <span className="block text-sm text-ink-soft">Others won&rsquo;t see your name or book. Your passport stays.</span>
            </span>
          </label>
          <button className="rounded-lg border border-ink/20 px-4 py-2">Save</button>
          {saved && <p role="status" className="text-sm text-ink-soft">Saved.</p>}
        </form>
      </section>

      <footer className="flex justify-between text-sm">
        <Link href="/" className="text-binding underline">Next meetup</Link>
        {!member.is_guest && (
          <form action={signOut}>
            <button className="text-ink-soft underline">Sign out</button>
          </form>
        )}
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse rounded-lg bg-paper-deep px-2 py-3">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="font-serif text-2xl">{value}</dd>
    </div>
  );
}
