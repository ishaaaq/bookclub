import { type NextRequest } from "next/server";
import { normaliseQuery, searchBooks } from "@/lib/books";
import { createClient } from "@/lib/supabase/server";

/** Open Library proxy + club cache (README §3). GET /api/books/search?q=americanah */
export async function GET(request: NextRequest) {
  const q = normaliseQuery(request.nextUrl.searchParams.get("q"));
  if (!q) return Response.json({ results: [] });

  const supabase = await createClient();
  const results = await searchBooks(supabase, q);
  return Response.json(
    { results },
    // Same query, same answer for a while: lets phones and the edge skip the round trip (F6).
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
  );
}
