"use server";

import { cacheBook, parseCandidate } from "@/lib/books";
import { ensureMember, UserError } from "@/lib/club";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Returns where to go rather than calling redirect(): the form treats a thrown call as "offline"
// and queues it, so success must not throw.
export type CheckinResult = { error: string } | { shelfUrl: string };

const FRIENDLY: Record<string, string> = {
  "invalid check-in code": "This check-in code doesn't work. Scan the QR code at the venue again.",
  "this meetup was cancelled": "This meetup was cancelled.",
  "check-in is only open on the day of the meetup": "Check-in is only open on the day of the meetup.",
};

/** Guest identity (if needed) → cache the book → check in. Returns the shelf URL on success. */
export async function checkIn(token: string, displayName: string | null, rawBook: unknown): Promise<CheckinResult> {
  const book = parseCandidate(rawBook);
  if (!book) return { error: "Pick a book, or type its title." };

  const supabase = await createClient();
  let meetupId: string;
  try {
    const { data: status } = await supabase.rpc("checkin_status", { p_token: token }).maybeSingle();
    if (!status) return { error: FRIENDLY["invalid check-in code"] };
    if (!status.is_open) return { error: FRIENDLY["check-in is only open on the day of the meetup"] };
    meetupId = status.meetup_id;

    await ensureMember(supabase, status.chapter_id, displayName);
    const bookId = await cacheBook(createServiceClient(), book);
    const { error } = await supabase.rpc("check_in", { p_token: token, p_book_id: bookId });
    if (error) return { error: FRIENDLY[error.message] ?? "Something went wrong. Try again." };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    console.error("check-in failed", e);
    return { error: "Something went wrong. Try again." };
  }
  return { shelfUrl: `/shelf/${meetupId}?checkedIn=1` };
}
