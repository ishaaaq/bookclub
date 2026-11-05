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

const MAILPIT = "http://127.0.0.1:55324";

/** The newest sign-in link sent to `email` by local Supabase (Mailpit). */
export async function magicLinkFor(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
      const link = msg.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\?\S+/)?.[0];
      if (link) return link.replace(/[)\]>.,]+$/, "");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email for ${email}`);
}

export async function deleteUserByEmail(email: string) {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((u) => u.email === email);
  if (user) {
    await service.from("members").delete().eq("auth_user_id", user.id);
    await service.auth.admin.deleteUser(user.id);
  }
}
