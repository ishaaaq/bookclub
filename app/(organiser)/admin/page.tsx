import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getChapter, getSchedule } from "@/lib/club";
import { formatDay, formatTime } from "@/lib/format";
import { nextMeetup, todayIn } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

// Host: QR display for the next meetup (core loop). Venue/time/cancel controls and insights come in Phase 3.

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/signin?next=/admin");

  const chapter = await getChapter(supabase);
  const { data: isHost } = await supabase.rpc("is_host", { p_chapter: chapter.id });
  if (!isHost) {
    return (
      <div className="space-y-3">
        <h1 className="font-serif text-2xl">Host</h1>
        <p className="text-ink-soft">This page is for the chapter&rsquo;s host. <Link href="/" className="text-binding underline">Back to the next meetup</Link></p>
      </div>
    );
  }

  const now = new Date();
  const { config, overrides } = await getSchedule(supabase, chapter, todayIn(chapter.timezone, now));
  const next = nextMeetup(now, config, overrides);

  const { data: meetupId, error } = await supabase.rpc("ensure_meetup", { p_chapter: chapter.id, p_date: next.date });
  if (error || !meetupId) throw error ?? new Error("Couldn't prepare the meetup");
  const [{ data: token }, { count }] = await Promise.all([
    supabase.rpc("meetup_checkin_token", { p_meetup: meetupId }),
    supabase.from("checkins").select("id", { count: "exact", head: true }).eq("meetup_id", meetupId),
  ]);

  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/checkin/${token}`;
  // Rendered on the server: the QR screen ships no JavaScript.
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1f1b16", light: "#ffffff" } });

  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <p className="text-sm text-ink-soft">Host</p>
        <h1 className="font-serif text-2xl">Check-in QR</h1>
        <p className="text-ink-soft">
          {formatDay(next.date, chapter.timezone)}, {formatTime(next.date, next.startTime, chapter.timezone)}. Project this screen or print it.
        </p>
      </header>

      <figure className="space-y-3 rounded-xl bg-white p-6 text-center">
        <p className="font-serif text-xl">Check in with your book</p>
        <div className="mx-auto w-full max-w-xs" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption className="text-sm text-ink-soft">Scan with your phone camera. No app or account needed.</figcaption>
      </figure>

      <div className="space-y-2 print:hidden">
        <p>
          <strong>{count ?? 0}</strong> checked in so far.{" "}
          <Link href={`/shelf/${meetupId}`} className="text-binding underline">Open the shelf</Link>
        </p>
        <p className="break-all text-xs text-ink-soft">{url}</p>
      </div>
    </div>
  );
}
