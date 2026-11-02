/**
 * Reading passport maths (README §2). Pure: dates are civil "YYYY-MM-DD" strings in the
 * chapter's timezone.
 */

import { addDays, type ISODate, type MeetupOverride, type ScheduleConfig } from "./schedule";

/** Every grid date from the anchor up to and including `today`, minus cancelled ones. */
export function heldMeetupDates(config: ScheduleConfig, overrides: readonly MeetupOverride[], today: ISODate): ISODate[] {
  const cancelled = new Set(overrides.filter((o) => o.status === "cancelled").map((o) => o.date));
  const out: ISODate[] = [];
  for (let d = config.anchorDate; d <= today; d = addDays(d, config.intervalDays)) {
    if (!cancelled.has(d)) out.push(d);
  }
  return out;
}

/**
 * Meetups attended in a row, counting back from the latest one held. A cancelled meetup
 * doesn't break a streak (it isn't in `held`), and today doesn't break it before you've
 * checked in.
 */
export function computeStreak(attended: ReadonlySet<ISODate>, held: readonly ISODate[], today: ISODate): number {
  let i = held.length - 1;
  if (i >= 0 && held[i] === today && !attended.has(today)) i--;
  let streak = 0;
  for (; i >= 0 && attended.has(held[i]); i--) streak++;
  return streak;
}
