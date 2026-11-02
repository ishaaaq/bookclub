import { describe, expect, it } from "vitest";
import { computeStreak, heldMeetupDates } from "./passport";
import type { ScheduleConfig } from "./schedule";

const config: ScheduleConfig = {
  anchorDate: "2026-10-24",
  intervalDays: 14,
  defaultStartTime: "16:00",
  defaultVenueId: "v1",
  timeZone: "Africa/Lagos",
};

describe("heldMeetupDates", () => {
  it("lists grid dates up to today, skipping cancelled ones", () => {
    expect(heldMeetupDates(config, [{ date: "2026-12-05", status: "cancelled" }], "2026-12-19")).toEqual([
      "2026-10-24",
      "2026-11-07",
      "2026-11-21",
      "2026-12-19",
    ]);
  });

  it("is empty before the anchor", () => {
    expect(heldMeetupDates(config, [], "2026-10-23")).toEqual([]);
  });
});

describe("computeStreak", () => {
  const held = ["2026-10-24", "2026-11-07", "2026-11-21"];

  it("counts back from the latest meetup", () => {
    expect(computeStreak(new Set(["2026-11-07", "2026-11-21"]), held, "2026-11-25")).toBe(2);
  });

  it("is zero if you missed the latest meetup", () => {
    expect(computeStreak(new Set(["2026-10-24", "2026-11-07"]), held, "2026-11-25")).toBe(0);
  });

  it("doesn't break on meetup day before you check in", () => {
    expect(computeStreak(new Set(["2026-10-24", "2026-11-07"]), held, "2026-11-21")).toBe(2);
    expect(computeStreak(new Set(["2026-10-24", "2026-11-07", "2026-11-21"]), held, "2026-11-21")).toBe(3);
  });

  it("skips over cancelled meetups", () => {
    const withGap = heldMeetupDates(config, [{ date: "2026-11-07", status: "cancelled" }], "2026-11-21");
    expect(computeStreak(new Set(["2026-10-24", "2026-11-21"]), withGap, "2026-11-21")).toBe(2);
  });

  it("is zero with no history", () => {
    expect(computeStreak(new Set(), [], "2026-10-01")).toBe(0);
  });
});
