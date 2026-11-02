import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rememberGuest } from "@/lib/guest";
import { createClient } from "@/lib/supabase/server";

// Email magic link + Google (README §3). Members never need this to check in; hosts do.

function safeNext(next: string | undefined) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

async function callbackUrl(next: string) {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${h.get("host")}/auth/callback?next=${encodeURIComponent(next)}`;
}

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  await rememberGuest(supabase);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await callbackUrl(next) },
  });
  redirect(error ? `/signin?next=${encodeURIComponent(next)}&error=send` : "/signin/sent");
}

async function signInWithGoogle(formData: FormData) {
  "use server";
  const next = safeNext(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  await rememberGuest(supabase);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(next) },
  });
  redirect(error || !data.url ? `/signin?next=${encodeURIComponent(next)}&error=google` : data.url);
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl">Sign in</h1>
      <p className="text-ink-soft">You don&rsquo;t need an account to check in. Sign in to keep your passport across phones (any check-ins you made as a guest come with you), or to host.</p>

      <form action={sendMagicLink} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="text-sm text-ink-soft">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-ink/20 bg-white px-3 py-3"
            />
          </label>
          <button className="w-full rounded-lg bg-binding px-4 py-3 font-medium text-paper">Email me a link</button>
      </form>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button className="w-full rounded-lg border border-ink/20 px-4 py-3">Continue with Google</button>
      </form>

      {error && (
        <p role="alert" className="text-binding">
          {error === "google" ? "Google sign-in isn't available right now." : "We couldn't send that link. Try again."}
        </p>
      )}
    </div>
  );
}
