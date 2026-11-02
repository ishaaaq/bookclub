"use server";

import { revalidatePath } from "next/cache";
import { getChapter, getMember } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

// Optional shares (F3) and want-to-read. RLS checks ownership; these only shape the input.

const KINDS = new Set(["line", "quote"]);

export async function addShare(formData: FormData) {
  const checkinId = String(formData.get("checkin_id") ?? "");
  const meetupId = String(formData.get("meetup_id") ?? "");
  const supabase = await createClient();

  const rating = Number(formData.get("rating"));
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
    // One rating per check-in: a new tap replaces the old one.
    await supabase.from("shares").delete().eq("checkin_id", checkinId).eq("kind", "rating");
    await supabase.from("shares").insert({ checkin_id: checkinId, kind: "rating", rating });
  } else {
    const kind = String(formData.get("kind") ?? "line");
    const body = String(formData.get("body") ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (!KINDS.has(kind) || !body) return;
    await supabase.from("shares").insert({ checkin_id: checkinId, kind: kind as "line" | "quote", body });
  }
  revalidatePath(`/shelf/${meetupId}`);
}

export async function deleteShare(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("shares").delete().eq("id", String(formData.get("share_id") ?? ""));
  revalidatePath(`/shelf/${String(formData.get("meetup_id") ?? "")}`);
}

export async function toggleWantToRead(formData: FormData) {
  const bookId = String(formData.get("book_id") ?? "");
  const supabase = await createClient();
  const member = await getMember(supabase, (await getChapter(supabase)).id);
  if (!member) return;

  if (formData.get("on") === "1") {
    await supabase.from("want_to_read").delete().eq("member_id", member.id).eq("book_id", bookId);
  } else {
    await supabase.from("want_to_read").upsert({ member_id: member.id, book_id: bookId }, { ignoreDuplicates: true });
  }
  revalidatePath(`/shelf/${String(formData.get("meetup_id") ?? "")}`);
}
