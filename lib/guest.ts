import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { GUEST_CLAIM_MAX_AGE_S, signGuestClaim, verifyGuestClaim } from "./guest-claim";
import type { Database } from "./supabase/database.types";
import { createServiceClient } from "./supabase/server";

const COOKIE = "sbc_guest_claim";
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Before leaving for sign-in: if this browser is a guest, remember which one. Server actions only. */
export async function rememberGuest(supabase: SupabaseClient<Database>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.is_anonymous) return;
  (await cookies()).set(COOKIE, signGuestClaim(user.id, secret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/callback",
    maxAge: GUEST_CLAIM_MAX_AGE_S,
  });
}

/**
 * After sign-in: moves the remembered guest's history onto the signed-in account and
 * deletes the guest. Safe to call when there's nothing to claim.
 */
export async function claimRememberedGuest(supabase: SupabaseClient<Database>) {
  const store = await cookies();
  const guestId = verifyGuestClaim(store.get(COOKIE)?.value, secret());
  store.delete({ name: COOKIE, path: "/auth/callback" });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (guestId && guestId !== user.id) {
    const service = createServiceClient();
    const { error } = await service.rpc("claim_guest", { p_guest_user: guestId, p_user: user.id });
    if (error) {
      console.error("guest claim failed", error);
    } else {
      await service.auth.admin.deleteUser(guestId);
    }
  }
  await supabase.rpc("sync_guest_status");
}
