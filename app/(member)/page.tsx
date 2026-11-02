import { headers } from "next/headers";
import Link from "next/link";
import { getChapter, getMember, getSchedule } from "@/lib/club";
import { formatDay, formatTime } from "@/lib/format";
import { nextMeetup, todayIn, upcomingMeetups } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { toggleIntent } from "./actions";

// Next meetup card (F5, F7, F8, F9). The date is computed; the host only touches exceptions.

export default async function HomePage({ searchParams }: { searchParams: Promise<{ intentError?: string }> }) {
  const { intentError } = await searchParams;
  const supabase = await createClient();
  const chapter = await getChapter(supabase);
  const now = new Date();
  const today = todayIn(chapter.timezone, now);

  const [{ config, overrides, meetups }, member, { data: venues }, { data: hosts }] = await Promise.all([
    getSchedule(supabase, chapter, today),
    getMember(supabase, chapter.id),
    supabase.from("venues").select("id, name, address, maps_url").eq("chapter_id", chapter.id),
    supabase.from("roles").select("members (display_name)").eq("chapter_id", chapter.id).eq("role", "host"),
  ]);

  const next = nextMeetup(now, config, overrides);
  const skipped = upcomingMeetups(now, 1, config, overrides)[0];
  const venue = venues?.find((v) => v.id === next.venueId);
  const row = meetups.find((m) => m.date === next.date);
  const hostName = hosts?.[0]?.members?.display_name;
  const isToday = next.date === today;

  const [{ data: planned }, { data: mine }] = row
    ? await Promise.all([
        supabase.rpc("intent_count", { p_meetup: row.id }),
        member
          ? supabase.from("intents").select("meetup_id").eq("meetup_id", row.id).eq("member_id", member.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
    : [{ data: 0 }, { data: null }];

  const day = formatDay(next.date, chapter.timezone);
  const time = formatTime(next.date, next.startTime, chapter.timezone);
  const h = await headers();
  const siteUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const shareText = `${chapter.name}: ${day}, ${time}${venue ? ` at ${venue.name}` : ""}. Bring whatever you're reading. ${siteUrl}`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-soft">Silent Book Club · {chapter.city}</p>
        <h1 className="font-serif text-2xl">{isToday ? "Today’s meetup" : "Next meetup"}</h1>
      </header>

      {skipped.status === "cancelled" && (
        <p className="rounded-lg border border-binding/30 p-3 text-sm">
          No meetup on {formatDay(skipped.date, chapter.timezone)}.{skipped.note ? ` ${skipped.note}` : ""}
        </p>
      )}

      <section className="space-y-4 rounded-xl bg-paper-deep p-5" aria-label="Next meetup">
        {next.note && <p className="rounded-lg bg-binding px-3 py-2 text-sm text-paper">{next.note}</p>}
        <div>
          <p className="font-serif text-xl">{day}</p>
          <p className="text-ink-soft">{time} · read for an hour, then talk</p>
        </div>
        {venue && (
          <div>
            <p className="font-medium">
              {venue.name}
              {next.status === "moved" && <span className="ml-2 text-sm text-binding">changed</span>}
            </p>
            {venue.address && <p className="text-sm text-ink-soft">{venue.address}</p>}
            {venue.maps_url && (
              <a href={venue.maps_url} className="text-sm text-binding underline" target="_blank" rel="noopener">
                Open in Maps
              </a>
            )}
          </div>
        )}
        {hostName && <p className="text-sm text-ink-soft">Hosted by {hostName}</p>}

        <form action={toggleIntent} className="space-y-2 border-t border-ink/10 pt-4">
          <input type="hidden" name="date" value={next.date} />
          {!member && !mine && (
            <label className="block">
              <span className="text-sm text-ink-soft">Your first name (it&rsquo;s also how you&rsquo;ll appear on the shelf)</span>
              <input name="name" maxLength={60} autoComplete="given-name" className="mt-1 block w-full rounded-lg border border-ink/20 bg-white px-3 py-2" />
            </label>
          )}
          <button className={`w-full rounded-lg px-4 py-3 font-medium ${mine ? "border border-ink/20" : "bg-binding text-paper"}`}>
            {mine ? "You’re thinking of coming ✓" : "I’m thinking of coming"}
          </button>
          <p className="text-sm text-ink-soft">
            {planned ? `${planned} ${planned === 1 ? "person plans" : "people plan"} to come. ` : ""}No need to book. Just show up.
          </p>
          {intentError && <p role="alert" className="text-sm text-binding">{intentError}</p>}
        </form>
      </section>

      <div className="flex flex-col gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          className="rounded-lg border border-ink/20 px-4 py-3 text-center"
          target="_blank"
          rel="noopener"
        >
          Share to WhatsApp
        </a>
        {chapter.whatsapp_url && (
          <a href={chapter.whatsapp_url} className="text-center text-sm text-binding underline" target="_blank" rel="noopener">
            Join the chapter&rsquo;s WhatsApp group
          </a>
        )}
        {isToday && row && (
          <Link href={`/shelf/${row.id}`} className="text-center text-binding underline">
            See today&rsquo;s shelf
          </Link>
        )}
      </div>

      <footer className="pt-4 text-center text-sm text-ink-soft">
        {member ? (
          <Link href="/passport" className="underline">Your passport</Link>
        ) : (
          <Link href="/signin" className="underline">Sign in</Link>
        )}
        {" · "}
        <Link href="/admin" className="underline">Host</Link>
      </footer>
    </div>
  );
}
