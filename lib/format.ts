// Display helpers. Everything renders in the chapter's timezone (Africa/Lagos), never the host's.

import { zonedTimeToUtc, type ISODate } from "./schedule";

/** "Saturday 7 November" */
export function formatDay(date: ISODate, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(
    zonedTimeToUtc(date, "12:00", timeZone),
  );
}

/** "4:00 pm" from "16:00" or "16:00:00" */
export function formatTime(date: ISODate, time: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(
    zonedTimeToUtc(date, time.slice(0, 5), timeZone),
  );
}
