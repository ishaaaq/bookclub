/**
 * Every-other-Saturday meetup schedule (README F5, F9).
 *
 * Pure: no I/O, no dependencies, no reliance on the host timezone. Dates are
 * civil dates ("YYYY-MM-DD") handled as whole UTC day numbers, so a server in
 * any timezone computes the same calendar. Only `startsAt` is an instant.
 *
 * Overrides never move a meetup off its grid date; they change venue, time or
 * note, or cancel it. Keep in sync with SQL `is_meetup_date()` in
 * supabase/migrations.
 */

export type ISODate = string; // "YYYY-MM-DD"
export type MeetupStatus = "scheduled" | "cancelled" | "moved";

export interface ScheduleConfig {
  anchorDate: ISODate;
  intervalDays: number;
  defaultStartTime: string; // "HH:MM", local to timeZone
  defaultVenueId: string;
  timeZone: string;
}

export interface MeetupOverride {
  date: ISODate;
  status?: MeetupStatus;
  startTime?: string;
  venueId?: string;
  note?: string;
}

export interface ResolvedMeetup {
  date: ISODate;
  startTime: string;
  venueId: string;
  status: MeetupStatus;
  note?: string;
  startsAt: Date;
  isOverridden: boolean;
}

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SATURDAY = 6;

// ---------------------------------------------------------------------------
// Civil-date helpers

function toDayNumber(date: ISODate): number {
  const m = ISO_DATE.exec(date);
  if (!m) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`Invalid date "${date}"`);
  }
  return ms / DAY_MS;
}

function fromDayNumber(day: number): ISODate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: ISODate): number {
  return new Date(toDayNumber(date) * DAY_MS).getUTCDay();
}

function parseTime(time: string): [number, number] {
  const m = HH_MM.exec(time);
  if (!m) throw new Error(`Invalid time "${time}", expected HH:MM`);
  return [Number(m[1]), Number(m[2])];
}

// ---------------------------------------------------------------------------
// Timezone helpers (Intl only)

function wallClockParts(instant: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const out: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
}

/** The calendar date it currently is in `timeZone`. */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  const p = wallClockParts(now, timeZone);
  return fromDayNumber(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS);
}

function offsetMs(instant: number, timeZone: string): number {
  const whole = Math.floor(instant / 1000) * 1000;
  const p = wallClockParts(new Date(whole), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - whole;
}

/** The UTC instant of a wall-clock `date` + `time` in `timeZone`. */
export function zonedTimeToUtc(date: ISODate, time: string, timeZone: string): Date {
  const [h, mi] = parseTime(time);
  const wall = toDayNumber(date) * DAY_MS + (h * 60 + mi) * 60_000;
  let utc = wall - offsetMs(wall, timeZone);
  utc = wall - offsetMs(utc, timeZone); // second pass settles DST transitions
  return new Date(utc);
}

// ---------------------------------------------------------------------------
// Schedule

export function isMeetupDate(date: ISODate, config: ScheduleConfig): boolean {
  const diff = toDayNumber(date) - toDayNumber(config.anchorDate);
  return diff >= 0 && diff % config.intervalDays === 0;
}

/** `count` grid dates on or after `from` (never before the anchor). */
export function meetupDatesFrom(from: ISODate, count: number, config: ScheduleConfig): ISODate[] {
  const anchor = toDayNumber(config.anchorDate);
  const start = Math.max(toDayNumber(from), anchor);
  const first = anchor + Math.ceil((start - anchor) / config.intervalDays) * config.intervalDays;
  return Array.from({ length: count }, (_, i) => fromDayNumber(first + i * config.intervalDays));
}

export function resolveMeetup(
  date: ISODate,
  config: ScheduleConfig,
  overrides: readonly MeetupOverride[] = [],
): ResolvedMeetup {
  if (!isMeetupDate(date, config)) {
    throw new Error(`${date} is not a scheduled meetup date`);
  }
  const o = overrides.find((x) => x.date === date);
  const startTime = o?.startTime ?? config.defaultStartTime;
  const venueId = o?.venueId ?? config.defaultVenueId;
  const changed = startTime !== config.defaultStartTime || venueId !== config.defaultVenueId;
  return {
    date,
    startTime,
    venueId,
    status: o?.status ?? (changed ? "moved" : "scheduled"),
    note: o?.note,
    startsAt: zonedTimeToUtc(date, startTime, config.timeZone),
    isOverridden: o !== undefined,
  };
}

/** The next `count` meetups from today (in the chapter timezone), cancelled ones included. */
export function upcomingMeetups(
  now: Date,
  count: number,
  config: ScheduleConfig,
  overrides: readonly MeetupOverride[] = [],
): ResolvedMeetup[] {
  return meetupDatesFrom(todayIn(config.timeZone, now), count, config).map((d) =>
    resolveMeetup(d, config, overrides),
  );
}

/** The next meetup that isn't cancelled. Today counts for the whole day. */
export function nextMeetup(
  now: Date,
  config: ScheduleConfig,
  overrides: readonly MeetupOverride[] = [],
): ResolvedMeetup {
  // At most overrides.length dates can be cancelled, so one more always suffices.
  const found = upcomingMeetups(now, overrides.length + 1, config, overrides).find(
    (m) => m.status !== "cancelled",
  );
  return found!;
}

/** Validates overrides from the host's form: on-grid, well-formed, one per date. */
export function assertValidOverrides(overrides: readonly MeetupOverride[], config: ScheduleConfig): void {
  const seen = new Set<ISODate>();
  for (const o of overrides) {
    if (!isMeetupDate(o.date, config)) throw new Error(`Override ${o.date} is not a scheduled meetup date`);
    if (seen.has(o.date)) throw new Error(`Duplicate override for ${o.date}`);
    if (o.startTime !== undefined) parseTime(o.startTime);
    seen.add(o.date);
  }
}

// ---------------------------------------------------------------------------
// Config

export function parseScheduleConfig(raw: {
  anchorDate?: string;
  intervalDays?: number;
  defaultStartTime?: string;
  defaultVenueId?: string;
  timeZone?: string;
}): ScheduleConfig {
  const { anchorDate, intervalDays = 14, defaultStartTime, defaultVenueId, timeZone } = raw;
  if (!anchorDate) throw new Error("Schedule anchor date is required");
  if (dayOfWeek(anchorDate) !== SATURDAY) throw new Error(`Anchor date ${anchorDate} is not a Saturday`);
  if (!Number.isInteger(intervalDays) || intervalDays <= 0 || intervalDays % 7 !== 0) {
    throw new Error(`Interval must be a positive whole number of weeks, got ${intervalDays}`);
  }
  if (!defaultStartTime) throw new Error("Default start time is required");
  parseTime(defaultStartTime);
  if (!defaultVenueId) throw new Error("Default venue is required");
  if (!timeZone) throw new Error("Time zone is required");
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    throw new Error(`Unknown time zone "${timeZone}"`);
  }
  return { anchorDate, intervalDays, defaultStartTime, defaultVenueId, timeZone };
}

/** Anchor and timezone from the environment (README §9). Start time and venue come from the `schedule` row. */
export function scheduleEnv(env: Record<string, string | undefined> = process.env) {
  return {
    anchorDate: env.SCHEDULE_ANCHOR_DATE ?? "2026-10-24",
    timeZone: env.NEXT_PUBLIC_APP_TIMEZONE ?? "Africa/Lagos",
  };
}

// ---------------------------------------------------------------------------
// Display

export function formatMeetupDate(m: Pick<ResolvedMeetup, "startsAt">, timeZone: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(m.startsAt);
}
