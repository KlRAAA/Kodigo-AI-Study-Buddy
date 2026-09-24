// Daily limits reset at midnight in the Philippines (Asia/Manila, UTC+8, no DST).

const manilaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns the Manila calendar day as YYYY-MM-DD. */
export function manilaDay(now: Date = new Date()): string {
  return manilaFormatter.format(now);
}

/** Next midnight UTC, used when a provider says its daily quota is used up. */
export function nextUtcMidnight(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
