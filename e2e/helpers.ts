import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

/** Service-role client for test setup only. */
export const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

/** Pretend it's `date` in the chapter, so check-in opens. Pass null to restore the real clock. */
export async function setDevClock(date: string | null) {
  const { error } = date
    ? await service.from("dev_clock").upsert({ singleton: true, today: date })
    : await service.from("dev_clock").delete().eq("singleton", true);
  if (error) throw error;
}

/** Removes members created by a test run (their check-ins and intents cascade). */
export async function deleteMembersNamed(name: string) {
  const { data } = await service.from("members").select("id, auth_user_id").eq("display_name", name);
  for (const m of data ?? []) {
    await service.from("members").delete().eq("id", m.id);
    if (m.auth_user_id) await service.auth.admin.deleteUser(m.auth_user_id);
  }
}
