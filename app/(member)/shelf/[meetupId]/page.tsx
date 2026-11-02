import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/BookCover";
import { ShelfSpine } from "@/components/ShelfSpine";
import { getMember } from "@/lib/club";
import { formatDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ShelfLive } from "./ShelfLive";

// Tonight's shelf (F2, F3): every book in the room. Display names only; hidden members are filtered by RLS.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      .select("id, member_id, created_at, members (display_name), books (id, title, author, cover_url)")
      .eq("meetup_id", meetupId)
      .order("created_at"),
    getMember(supabase, meetup.chapter_id),
    supabase.rpc("chapter_today", { p_chapter: meetup.chapter_id }),
  ]);

  // Group by book: "3 people brought Americanah".
  const shelf = new Map<string, { book: NonNullable<NonNullable<typeof checkins>[number]["books"]>; readers: string[]; mine: boolean }>();
  for (const c of checkins ?? []) {
    if (!c.books) continue;
    const entry = shelf.get(c.books.id) ?? { book: c.books, readers: [], mine: false };
    entry.readers.push(c.members?.display_name ?? "A member");
    entry.mine ||= c.member_id === member?.id;
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
              <li
                key={book.id}
                id={`book-${book.id}`}
                className="flex scroll-mt-4 gap-3 rounded-lg p-2 target:bg-paper-deep"
              >
                <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} />
                <div className="min-w-0">
                  <p className="font-serif leading-snug">{book.title}</p>
                  {book.author && <p className="text-sm text-ink-soft">{book.author}</p>}
                  <p className="mt-1 text-sm">
                    {readers.join(", ")}
                    {mine && <span className="text-ink-soft"> (that&rsquo;s you)</span>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link href="/" className="inline-block text-binding underline">
        Next meetup
      </Link>
    </div>
  );
}
