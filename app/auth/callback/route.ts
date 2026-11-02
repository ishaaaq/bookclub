import { NextResponse, type NextRequest } from "next/server";
import { claimRememberedGuest } from "@/lib/guest";
import { createClient } from "@/lib/supabase/server";

/** Magic-link and OAuth redirect target: trades the one-time code for a session, then claims any guest history. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await claimRememberedGuest(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/signin?error=link`);
}
