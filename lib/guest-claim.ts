import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A signed note that says "this browser was guest <userId>", carried across the sign-in
 * redirect so the auth callback can move the guest's history onto the new account.
 * Pure so it can be unit-tested; lib/guest.ts handles the cookie.
 */

const MAX_AGE_S = 60 * 60 * 24;

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`guest-claim:${payload}`).digest("base64url");
}

export function signGuestClaim(userId: string, secret: string, now = Date.now()): string {
  const payload = `${userId}.${Math.floor(now / 1000)}`;
  return `${payload}.${mac(payload, secret)}`;
}

/** The guest's user id if the claim is authentic and fresh, else null. */
export function verifyGuestClaim(value: string | undefined, secret: string, now = Date.now()): string | null {
  const parts = value?.split(".");
  if (!parts || parts.length !== 3) return null;
  const [userId, issued, sig] = parts;
  const expected = Buffer.from(mac(`${userId}.${issued}`, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const age = now / 1000 - Number(issued);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_S) return null;
  return userId;
}

export const GUEST_CLAIM_MAX_AGE_S = MAX_AGE_S;
