"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getChapter, getMember } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

/** Display name and "hide me from the shelf" (README §5). */
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const member = await getMember(supabase, (await getChapter(supabase)).id);
  if (!member) redirect("/passport");

  const name = String(formData.get("display_name") ?? "").replace(/\s+/g, " ").trim();
  const { error } = await supabase
    .from("members")
    .update({
      display_name: name ? name.slice(0, 60) : member.display_name,
      hide_from_shelf: formData.get("hide_from_shelf") === "on",
    })
    .eq("id", member.id);
  if (error) throw error;
  revalidatePath("/", "layout");
  redirect("/passport?saved=1");
}

export async function removeWantToRead(formData: FormData) {
  const supabase = await createClient();
  const member = await getMember(supabase, (await getChapter(supabase)).id);
  if (!member) return;
  await supabase.from("want_to_read").delete().eq("member_id", member.id).eq("book_id", String(formData.get("book_id")));
  revalidatePath("/passport");
}

/** Only offered to signed-in accounts: signing a guest out would orphan their passport. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
