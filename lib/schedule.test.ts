import { describe, expect, it } from "vitest";
import {
  addDays,
  assertValidOverrides,
  dayOfWeek,
  formatMeetupDate,
  isMeetupDate,
  meetupDatesFrom,
  nextMeetup,
  parseScheduleConfig,
  resolveMeetup,
  scheduleEnv,
  todayIn,
  upcomingMeetups,
  zonedTimeToUtc,
  type ScheduleConfig,
} from "./schedule";

const config: ScheduleConfig = {
  anchorDate: "2026-10-24",
  intervalDays: 14,
  defaultStartTime: "16:00",
  defaultVenueId: "venue-usual",
  timeZone: "Africa/Lagos",
};

describe("meetupDatesFrom", () => {
  it("runs 24 Oct, 7 Nov, 21 Nov, 5 Dec from the anchor (README §11)", () => {
    expect(meetupDatesFrom("2026-10-24", 4, config)).toEqual([
      "2026-10-24",
      "2026-11-07",
      "2026-11-21",
      "2026-12-05",
    ]);
  });

  it("crosses the year boundary", () => {
    expect(meetupDatesFrom("2026-12-06", 2, config)).toEqual(["2026-12-19", "2027-01-02"]);
  });

  it("never returns a date before the anchor", () => {
    expect(meetupDatesFrom("2026-01-01", 1, config)).toEqual(["2026-10-24"]);
  });

  it("starts from the next grid date when `from` is between meetups", () => {
    expect(meetupDatesFrom("2026-10-25", 1, config)).toEqual(["2026-11-07"]);
    expect(meetupDatesFrom("2026-10-31", 1, config)).toEqual(["2026-11-07"]);
  });

  it("produces only Saturdays, 14 days apart, for two years", () => {
    const dates = meetupDatesFrom("2026-10-24", 53, config);
    dates.forEach((d, i) => {
      expect(dayOfWeek(d)).toBe(6);
      if (i > 0) expect(addDays(dates[i - 1], 14)).toBe(d);
    });
    expect(dates.at(-1)).toBe("2028-10-21");
  });
});

describe("isMeetupDate", () => {
  it("is true on the grid", () => {
    expect(isMeetupDate("2026-10-24", config)).toBe(true);
    expect(isMeetupDate("2026-11-07", config)).toBe(true);
    expect(isMeetupDate("2027-01-02", config)).toBe(true);
  });

  it("is false on in-between Saturdays, other days, and before the anchor", () => {
    expect(isMeetupDate("2026-10-31", config)).toBe(false);
    expect(isMeetupDate("2026-11-08", config)).toBe(false);
    expect(isMeetupDate("2026-10-10", config)).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(() => isMeetupDate("2026-02-30", config)).toThrow();
    expect(() => isMeetupDate("24/10/2026", config)).toThrow();
  });
});

describe("todayIn", () => {
  it("is already Saturday in Lagos at Friday 23:30 UTC", () => {
    expect(todayIn("Africa/Lagos", new Date("2026-11-06T23:30:00Z"))).toBe("2026-11-07");
  });

  it("is still Friday in Lagos at Friday 22:59 UTC", () => {
    expect(todayIn("Africa/Lagos", new Date("2026-11-06T22:59:00Z"))).toBe("2026-11-06");
  });
});

describe("zonedTimeToUtc", () => {
  it("converts 16:00 WAT to 15:00Z", () => {
    expect(zonedTimeToUtc("2026-11-07", "16:00", "Africa/Lagos").toISOString()).toBe(
      "2026-11-07T15:00:00.000Z",
    );
  });

  it("handles a DST zone", () => {
    expect(zonedTimeToUtc("2026-07-04", "16:00", "Europe/London").toISOString()).toBe(
      "2026-07-04T15:00:00.000Z",
    );
    expect(zonedTimeToUtc("2026-12-05", "16:00", "Europe/London").toISOString()).toBe(
      "2026-12-05T16:00:00.000Z",
    );
  });
});

describe("resolveMeetup", () => {
  it("uses the defaults with no override", () => {
    expect(resolveMeetup("2026-11-07", config)).toEqual({
      date: "2026-11-07",
      startTime: "16:00",
      venueId: "venue-usual",
      status: "scheduled",
      note: undefined,
      startsAt: new Date("2026-11-07T15:00:00Z"),
      isOverridden: false,
    });
  });

  it("marks a venue change as moved and keeps the default time", () => {
    const m = resolveMeetup("2026-11-21", config, [
      { date: "2026-11-21", venueId: "venue-alt", note: "Venue changed this week" },
    ]);
    expect(m).toMatchObject({
      status: "moved",
      venueId: "venue-alt",
      startTime: "16:00",
      note: "Venue changed this week",
      isOverridden: true,
    });
  });

  it("applies a time shift", () => {
    const m = resolveMeetup("2026-11-21", config, [{ date: "2026-11-21", startTime: "15:00" }]);
    expect(m.status).toBe("moved");
    expect(m.startsAt.toISOString()).toBe("2026-11-21T14:00:00.000Z");
  });

  it("keeps a note-only override as scheduled", () => {
    const m = resolveMeetup("2026-11-07", config, [{ date: "2026-11-07", note: "Bring a friend" }]);
    expect(m.status).toBe("scheduled");
    expect(m.isOverridden).toBe(true);
  });

  it("respects an explicit cancelled status", () => {
    const m = resolveMeetup("2026-12-05", config, [{ date: "2026-12-05", status: "cancelled" }]);
    expect(m.status).toBe("cancelled");
  });

  it("throws for an off-grid date", () => {
    expect(() => resolveMeetup("2026-10-31", config)).toThrow(/not a scheduled meetup date/);
  });
});

describe("upcomingMeetups / nextMeetup", () => {
  const overrides = [
    { date: "2026-11-07", status: "cancelled" as const },
    { date: "2026-11-21", status: "cancelled" as const },
  ];

  it("lists cancelled meetups but nextMeetup skips them", () => {
    const now = new Date("2026-10-27T10:00:00Z");
    expect(upcomingMeetups(now, 3, config, overrides).map((m) => [m.date, m.status])).toEqual([
      ["2026-11-07", "cancelled"],
      ["2026-11-21", "cancelled"],
      ["2026-12-05", "scheduled"],
    ]);
    expect(nextMeetup(now, config, overrides).date).toBe("2026-12-05");
  });

  it("returns today on a meetup day, even after the start time", () => {
    expect(nextMeetup(new Date("2026-11-07T20:00:00Z"), config).date).toBe("2026-11-07");
  });

  it("returns the anchor before the schedule starts", () => {
    expect(nextMeetup(new Date("2026-09-01T12:00:00Z"), config).date).toBe("2026-10-24");
  });

  it("rolls over at Lagos midnight, not UTC midnight", () => {
    // Sat 7 Nov 23:30 UTC is Sun 8 Nov 00:30 in Lagos.
    expect(nextMeetup(new Date("2026-11-07T23:30:00Z"), config).date).toBe("2026-11-21");
  });
});

describe("assertValidOverrides", () => {
  it("accepts on-grid overrides", () => {
    expect(() =>
      assertValidOverrides([{ date: "2026-11-07", startTime: "15:30" }, { date: "2026-11-21" }], config),
    ).not.toThrow();
  });

  it("rejects off-grid dates, duplicates and bad times", () => {
    expect(() => assertValidOverrides([{ date: "2026-11-08" }], config)).toThrow();
    expect(() => assertValidOverrides([{ date: "2026-11-07" }, { date: "2026-11-07" }], config)).toThrow(
      /Duplicate/,
    );
    expect(() => assertValidOverrides([{ date: "2026-11-07", startTime: "4pm" }], config)).toThrow();
  });
});

describe("parseScheduleConfig", () => {
  const valid = {
    anchorDate: "2026-10-24",
    defaultStartTime: "16:00",
    defaultVenueId: "v",
    timeZone: "Africa/Lagos",
  };

  it("defaults the interval to 14 days", () => {
    expect(parseScheduleConfig(valid).intervalDays).toBe(14);
  });

  it("rejects a non-Saturday anchor", () => {
    expect(() => parseScheduleConfig({ ...valid, anchorDate: "2026-10-25" })).toThrow(/not a Saturday/);
  });

  it("rejects bad formats", () => {
    expect(() => parseScheduleConfig({ ...valid, anchorDate: "24-10-2026" })).toThrow();
    expect(() => parseScheduleConfig({ ...valid, defaultStartTime: "25:00" })).toThrow();
    expect(() => parseScheduleConfig({ ...valid, timeZone: "Mars/Olympus" })).toThrow(/time zone/);
    expect(() => parseScheduleConfig({ ...valid, intervalDays: 10 })).toThrow(/weeks/);
  });

  it("reads anchor and timezone from env with README defaults", () => {
    expect(scheduleEnv({})).toEqual({ anchorDate: "2026-10-24", timeZone: "Africa/Lagos" });
    expect(scheduleEnv({ SCHEDULE_ANCHOR_DATE: "2026-11-07" }).anchorDate).toBe("2026-11-07");
  });
});

describe("formatMeetupDate", () => {
  it("formats in the chapter timezone", () => {
    const s = formatMeetupDate({ startsAt: new Date("2026-11-07T15:00:00Z") }, "Africa/Lagos");
    expect(s).toMatch(/Saturday/);
    expect(s).toMatch(/7 November/);
    expect(s).toMatch(/\b4:00\s?pm/i);
  });
});
