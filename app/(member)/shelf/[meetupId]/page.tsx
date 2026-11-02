import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/BookCover";
import { ShelfSpine } from "@/components/ShelfSpine";
import { getMember } from "@/lib/club";
import { formatDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { addShare, deleteShare, toggleWantToRead } from "./actions";
import { ShelfLive } from "./ShelfLive";

// Tonight's shelf (F2, F3): every book in the room. Display names only; hidden members are filtered by RLS.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Share {
  id: string;
  kind: "line" | "quote" | "rating";
  body: string | null;
  rating: number | null;
}

interface Reader {
  checkinId: string;
  name: string;
  mine: boolean;
  shares: Share[];
}

export default async function ShelfPage({
  params,
  searchParams,
}: {
  params: Promise<{ meetupId: string }>;
  searchParams: Promise<{ checkedIn?: string }>;
}) {
  const [{ meetupId }, { checkedIn }] = await Promise.all([params, searchParams]);
  if (!UUID.test(meetupId)) notFound();

  const supabase = await createClient();
  const { data: meetup } = await supabase
    .from("meetups")
    .select("id, date, chapter_id, venues (name), chapters (timezone)")
    .eq("id", meetupId)
    .maybeSingle();
  if (!meetup) notFound();

  const tz = meetup.chapters?.timezone ?? "Africa/Lagos";
  const [{ data: checkins }, member, { data: today }] = await Promise.all([
    supabase
      .from("checkins")
      .select(
        "id, member_id, created_at, members (display_name), books (id, title, author, cover_url), shares (id, kind, body, rating, created_at)",
      )
      .eq("meetup_id", meetupId)
      .order("created_at"),
    getMember(supabase, meetup.chapter_id),
    supabase.rpc("chapter_today", { p_chapter: meetup.chapter_id }),
  ]);
  const { data: wants } = member
    ? await supabase.from("want_to_read").select("book_id").eq("member_id", member.id)
    : { data: [] };
  const wanted = new Set((wants ?? []).map((w) => w.book_id));

  // Group by book: "3 people brought Americanah".
  type Book = NonNullable<NonNullable<typeof checkins>[number]["books"]>;
  const shelf = new Map<string, { book: Book; readers: Reader[]; mine: boolean }>();
  for (const c of checkins ?? []) {
    if (!c.books) continue;
    const entry = shelf.get(c.books.id) ?? { book: c.books, readers: [], mine: false };
    const mine = c.member_id === member?.id;
    entry.readers.push({
      checkinId: c.id,
      name: c.members?.display_name ?? "A member",
      mine,
      shares: [...c.shares].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    });
    entry.mine ||= mine;
    shelf.set(c.books.id, entry);
  }
  const books = [...shelf.values()];
  const people = checkins?.length ?? 0;
  const isTonight = meetup.date === today;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-soft">
            {formatDay(meetup.date, tz)}
            {meetup.venues?.name ? ` · ${meetup.venues.name}` : ""}
          </p>
          {isTonight && <ShelfLive meetupId={meetupId} />}
        </div>
        <h1 className="font-serif text-2xl">{isTonight ? "Tonight’s shelf" : "The shelf"}</h1>
        <p className="text-ink-soft">
          {people === 0
            ? "No books yet. The first one in sets the tone."
            : `${people} ${people === 1 ? "reader" : "readers"}, ${books.length} ${books.length === 1 ? "book" : "books"}`}
        </p>
      </header>

      {checkedIn && (
        <p role="status" className="rounded-lg bg-paper-deep p-4">
          You&rsquo;re on the shelf. Enjoy the reading hour.
        </p>
      )}

      {books.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-1 border-b-8 border-[#5a3f2a] pb-0" aria-label="Books in the room">
            {books.map(({ book, readers }) => (
              <ShelfSpine key={book.id} href={`#book-${book.id}`} title={book.title} author={book.author} count={readers.length} />
            ))}
          </div>

          <ul className="space-y-3">
            {books.map(({ book, readers, mine }) => (
              <li key={book.id} id={`book-${book.id}`} className="flex scroll-mt-4 gap-3 rounded-lg p-2 target:bg-paper-deep">
                <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="font-serif leading-snug">{book.title}</p>
                    {book.author && <p className="text-sm text-ink-soft">{book.author}</p>}
                  </div>

                  <ul className="space-y-1 text-sm">
                    {readers.map((r) => (
                      <li key={r.checkinId}>
                        {r.name}
                        {r.mine && <span className="text-ink-soft"> (that&rsquo;s you)</span>}
                        {r.shares.map((s) => (
                          <ShareLine key={s.id} share={s} mine={r.mine} meetupId={meetupId} />
                        ))}
                        {r.mine && <ShareForm checkinId={r.checkinId} meetupId={meetupId} />}
                      </li>
                    ))}
                  </ul>

                  {member && !mine && (
                    <form action={toggleWantToRead}>
                      <input type="hidden" name="book_id" value={book.id} />
                      <input type="hidden" name="meetup_id" value={meetupId} />
                      <input type="hidden" name="on" value={wanted.has(book.id) ? "1" : "0"} />
                      <button className="text-sm text-binding underline">
                        {wanted.has(book.id) ? "On your want-to-read list ✓" : "Want to read"}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <nav className="flex justify-between text-sm">
        <Link href="/" className="text-binding underline">Next meetup</Link>
        {member && <Link href="/passport" className="text-binding underline">Your passport</Link>}
      </nav>
    </div>
  );
}

function ShareLine({ share, mine, meetupId }: { share: Share; mine: boolean; meetupId: string }) {
  return (
    <div className="mt-1 flex items-start gap-2 border-l-2 border-binding/40 pl-2 text-ink-soft">
      <span className="flex-1">
        {share.kind === "rating" ? (
          <span aria-label={`Rated ${share.rating} out of 5`}>{"★".repeat(share.rating ?? 0)}{"☆".repeat(5 - (share.rating ?? 0))}</span>
        ) : share.kind === "quote" ? (
          <q className="italic">{share.body}</q>
        ) : (
          share.body
        )}
      </span>
      {mine && (
        <form action={deleteShare}>
          <input type="hidden" name="share_id" value={share.id} />
          <input type="hidden" name="meetup_id" value={meetupId} />
          <button className="text-xs underline" aria-label="Delete this share">Delete</button>
        </form>
      )}
    </div>
  );
}

/** Opt-in and collapsed by default: skipping is the default (F3). */
function ShareForm({ checkinId, meetupId }: { checkinId: string; meetupId: string }) {
  return (
    <details className="mt-2 rounded-lg bg-paper-deep p-3">
      <summary className="cursor-pointer text-binding">Add a thought (optional)</summary>
      <form action={addShare} className="mt-3 space-y-2">
        <input type="hidden" name="checkin_id" value={checkinId} />
        <input type="hidden" name="meetup_id" value={meetupId} />
        <fieldset className="flex gap-4">
          <legend className="sr-only">Kind</legend>
          <label className="flex items-center gap-1">
            <input type="radio" name="kind" value="line" defaultChecked className="accent-binding" /> A line
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="kind" value="quote" className="accent-binding" /> A quote
          </label>
        </fieldset>
        <label className="block">
          <span className="sr-only">Your line or quote</span>
          <textarea name="body" rows={2} maxLength={500} required className="block w-full rounded-lg border border-ink/20 bg-white px-3 py-2" />
        </label>
        <button className="rounded-lg bg-binding px-3 py-2 text-paper">Add</button>
      </form>
      <form action={addShare} className="mt-3">
        <input type="hidden" name="checkin_id" value={checkinId} />
        <input type="hidden" name="meetup_id" value={meetupId} />
        <p className="text-ink-soft">Or rate it:</p>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} name="rating" value={n} className="h-10 w-10 rounded-lg border border-ink/20 bg-white" aria-label={`Rate ${n} out of 5`}>
              {n}
            </button>
          ))}
        </div>
      </form>
    </details>
  );
}
