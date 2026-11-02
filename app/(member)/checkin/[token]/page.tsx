import Link from "next/link";
import { getMember } from "@/lib/club";
import { formatDay, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CheckinForm } from "./CheckinForm";

// QR landing → book search → confirm (core loop).

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: meetup } = await supabase.rpc("checkin_status", { p_token: token }).maybeSingle();

  if (!meetup) {
    return (
      <Notice title="That code doesn't work">
        Scan the QR code at the venue again, or ask the host. <Link href="/" className="text-binding underline">See the next meetup</Link>
      </Notice>
    );
  }

  const { data: chapter } = await supabase.from("chapters").select("timezone").eq("id", meetup.chapter_id).single();
  const tz = chapter?.timezone ?? "Africa/Lagos";
  const when = `${formatDay(meetup.date, tz)}, ${formatTime(meetup.date, meetup.start_time, tz)}`;

  if (meetup.status === "cancelled") {
    return <Notice title="This meetup was cancelled">{when} isn&rsquo;t happening. <Link href="/" className="text-binding underline">See the next one</Link></Notice>;
  }
  if (!meetup.is_open) {
    return (
      <Notice title="Check-in isn't open yet">
        It opens on the day: {when} at {meetup.venue_name}. See you there.
      </Notice>
    );
  }

  const member = await getMember(supabase, meetup.chapter_id);
  const { data: current } = member
    ? await supabase
        .from("checkins")
        .select("books (title)")
        .eq("meetup_id", meetup.meetup_id)
        .eq("member_id", member.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-soft">{meetup.venue_name}</p>
        <h1 className="font-serif text-2xl">Check in with your book</h1>
        {member && <p className="mt-1 text-ink-soft">Welcome back, {member.display_name}.</p>}
      </header>

      {current?.books && (
        <p className="rounded-lg bg-paper-deep p-4">
          You&rsquo;re on the shelf with <em>{current.books.title}</em>. Pick another book to change it, or{" "}
          <Link href={`/shelf/${meetup.meetup_id}`} className="text-binding underline">see tonight&rsquo;s shelf</Link>.
        </p>
      )}

      <CheckinForm token={token} needsName={!member} />
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-2xl">{title}</h1>
      <p className="text-ink-soft">{children}</p>
    </div>
  );
}
