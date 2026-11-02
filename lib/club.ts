import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { parseScheduleConfig, type MeetupOverride, type ScheduleConfig } from "./schedule";

type Client = SupabaseClient<Database>;

/** The chapter this deployment serves. One row today (F10). */
export async function getChapter(supabase: Client) {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, name, city, timezone, whatsapp_url")
    .order("name")
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

/** The signed-in user's member profile in this chapter, or null (signed out, or a guest who hasn't named themselves). */
export async function getMember(supabase: Client, chapterId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: id } = await supabase.rpc("current_member_id", { p_chapter: chapterId });
  if (!id) return null;
  const { data } = await supabase
    .from("members")
    .select("id, display_name, is_guest, hide_from_shelf")
    .eq("id", id)
    .single();
  return data;
}

/**
 * Returns the caller's member id, creating a guest identity first if needed (F1: no sign-up
 * at the door). Must run in a server action or route handler so the session cookie can be set.
 */
export async function ensureMember(supabase: Client, chapterId: string, displayName: string | null) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: id } = await supabase.rpc("current_member_id", { p_chapter: chapterId });
    if (id) return id;
  }
  const name = displayName?.trim();
  if (!name) throw new UserError("Tell us your name so it can go on the shelf.");
  if (name.length > 60) throw new UserError("That name is a bit long. Try 60 characters or fewer.");
  if (!user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data: id, error } = await supabase.rpc("join_chapter", { p_chapter: chapterId, p_display_name: name });
  if (error) throw error;
  return id;
}

/** The schedule config plus every stored meetup row from `from` on, as overrides. */
export async function getSchedule(supabase: Client, chapter: { id: string; timezone: string }, from: string) {
  const [{ data: s, error }, { data: rows }] = await Promise.all([
    supabase
      .from("schedule")
      .select("anchor_date, interval_days, default_start_time, default_venue_id")
      .eq("chapter_id", chapter.id)
      .single(),
    supabase
      .from("meetups")
      .select("id, date, start_time, venue_id, status, note")
      .eq("chapter_id", chapter.id)
      .gte("date", from)
      .order("date"),
  ]);
  if (error) throw error;
  const config: ScheduleConfig = parseScheduleConfig({
    anchorDate: s.anchor_date,
    intervalDays: s.interval_days,
    defaultStartTime: s.default_start_time.slice(0, 5),
    defaultVenueId: s.default_venue_id,
    timeZone: chapter.timezone,
  });
  const meetups = rows ?? [];
  const overrides: MeetupOverride[] = meetups.map((m) => ({
    date: m.date,
    status: m.status,
    startTime: m.start_time.slice(0, 5),
    venueId: m.venue_id,
    note: m.note ?? undefined,
  }));
  return { config, overrides, meetups };
}

/** An error whose message is safe and friendly enough to show a member. */
export class UserError extends Error {}
