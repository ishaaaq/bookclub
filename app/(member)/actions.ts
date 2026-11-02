"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureMember, getChapter, UserError } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

/** "I'm thinking of coming" (F1, F4): one tap, toggles, never a booking. */
export async function toggleIntent(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const name = formData.get("name");
  const supabase = await createClient();
  const chapter = await getChapter(supabase);

  let memberId: string;
  try {
    memberId = await ensureMember(supabase, chapter.id, typeof name === "string" ? name : null);
  } catch (e) {
    if (e instanceof UserError) redirect(`/?intentError=${encodeURIComponent(e.message)}`);
    throw e;
  }

  const { data: meetupId, error } = await supabase.rpc("ensure_meetup", { p_chapter: chapter.id, p_date: date });
  if (error || !meetupId) throw error ?? new Error("No meetup for that date");

  const { data: existing } = await supabase
    .from("intents")
    .select("meetup_id")
    .eq("meetup_id", meetupId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (existing) {
    await supabase.from("intents").delete().eq("meetup_id", meetupId).eq("member_id", memberId);
  } else {
    await supabase.from("intents").insert({ meetup_id: meetupId, member_id: memberId });
  }
  revalidatePath("/");
}
