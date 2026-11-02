import { describe, expect, it } from "vitest";
import { signGuestClaim, verifyGuestClaim } from "./guest-claim";

const SECRET = "test-secret";
const USER = "3f1c2d4e-0000-4000-8000-000000000001";
const NOW = Date.UTC(2026, 10, 7, 15, 0);

describe("guest claim", () => {
  it("round-trips a fresh claim", () => {
    expect(verifyGuestClaim(signGuestClaim(USER, SECRET, NOW), SECRET, NOW + 60_000)).toBe(USER);
  });

  it("rejects a claim signed with another secret", () => {
    expect(verifyGuestClaim(signGuestClaim(USER, "other", NOW), SECRET, NOW)).toBeNull();
  });

  it("rejects a claim for a different user id", () => {
    const [, issued, sig] = signGuestClaim(USER, SECRET, NOW).split(".");
    expect(verifyGuestClaim(`someone-else.${issued}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it("expires after a day", () => {
    const claim = signGuestClaim(USER, SECRET, NOW);
    expect(verifyGuestClaim(claim, SECRET, NOW + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("ignores missing or malformed values", () => {
    expect(verifyGuestClaim(undefined, SECRET, NOW)).toBeNull();
    expect(verifyGuestClaim("nope", SECRET, NOW)).toBeNull();
    expect(verifyGuestClaim("a.b.c.d", SECRET, NOW)).toBeNull();
  });
});
