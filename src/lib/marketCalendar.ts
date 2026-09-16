const MARKET_TIMEZONE = "America/New_York";
const MARKET_CLOSE_HOUR = 16;

const formatDateInZone = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const getZonedParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

const easterUtc = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
};

const nthWeekdayOfMonth = (year: number, monthIndex: number, weekday: number, occurrence: number) => {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + offset + (occurrence - 1) * 7));
};

const lastWeekdayOfMonth = (year: number, monthIndex: number, weekday: number) => {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, monthIndex + 1, 0 - offset));
};

const observedIfWeekend = (date: Date) => {
  const day = date.getUTCDay();
  if (day === 0) return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  if (day === 6) return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1));
  return date;
};

const holidayCache = new Map<number, Set<string>>();
const usMarketHolidaySet = (year: number) => {
  const cached = holidayCache.get(year); if (cached) return cached;
  const holidays = [
    // NYSE does not observe a Saturday New Year on the preceding Friday.
    new Date(Date.UTC(year, 0, 1)).getUTCDay() === 6
      ? new Date(Date.UTC(year, 0, 1))
      : observedIfWeekend(new Date(Date.UTC(year, 0, 1))),
    nthWeekdayOfMonth(year, 0, 1, 3),
    nthWeekdayOfMonth(year, 1, 1, 3),
    new Date(easterUtc(year).getTime() - 2 * 24 * 60 * 60 * 1000),
    lastWeekdayOfMonth(year, 4, 1),
    observedIfWeekend(new Date(Date.UTC(year, 5, 19))),
    observedIfWeekend(new Date(Date.UTC(year, 6, 4))),
    nthWeekdayOfMonth(year, 8, 1, 1),
    nthWeekdayOfMonth(year, 10, 4, 4),
    observedIfWeekend(new Date(Date.UTC(year, 11, 25))),
  ];
  const result = new Set(holidays.map((holiday) => holiday.toISOString().slice(0, 10)));
  holidayCache.set(year, result); return result;
};

/** Calendar dates are YYYY-MM-DD, never midnight instants reinterpreted in ET.
 * Regular NYSE equity sessions. Calendar reviewed through 2028-12-31.
 * Source: https://www.nyse.com/trade/hours-calendars (2026-09-15).
 */
export const CALENDAR_VERSION = "NYSE-2026-09-15";
export const CALENDAR_VALID_THROUGH = "2028-12-31";
const exceptionalClosures = new Set(["2025-01-09"]);
const earlyCloses = new Set([
  "2024-07-03", "2024-11-29", "2024-12-24",
  "2025-07-03", "2025-11-28", "2025-12-24",
  "2026-11-27", "2026-12-24", "2027-11-26", "2028-07-03", "2028-11-24",
]);
export const isSessionDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const assertCoverage = (date: string) => {
  if (!isSessionDate(date) || date < "2024-01-01" || date > CALENDAR_VALID_THROUGH) {
    throw new Error("NYSE calendar covers 2024–2028; update the calendar before scheduling outside this range.");
  }
};
export const shiftSessionDate = (date: string, days: number) => {
  const cursor = new Date(`${date}T12:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
};
export const isUsTradingDate = (date: string) => {
  assertCoverage(date);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6 && !exceptionalClosures.has(date)
    && !usMarketHolidaySet(Number(date.slice(0, 4))).has(date);
};
export const previousUsTradingDate = (date: string): string => {
  let cursor = shiftSessionDate(date, -1);
  while (!isUsTradingDate(cursor)) cursor = shiftSessionDate(cursor, -1);
  return cursor;
};
export const isUsTradingDay = (instant: Date) => isUsTradingDate(formatDateInZone(instant));
export const previousUsTradingDay = (instant: Date) =>
  new Date(`${previousUsTradingDate(formatDateInZone(instant))}T12:00:00Z`);
export const marketCloseMinutes = (date: string) => earlyCloses.has(date) ? 13 * 60 : MARKET_CLOSE_HOUR * 60;
export const latestCompletedTradingDate = (now = new Date(), providerDelayMinutesAfterClose = 45) => {
  if (!Number.isFinite(providerDelayMinutesAfterClose) || providerDelayMinutesAfterClose < 0 || providerDelayMinutesAfterClose > 360) {
    throw new Error("Provider delay must be between 0 and 360 minutes.");
  }
  const date = formatDateInZone(now);
  const parts = getZonedParts(now);
  return isUsTradingDate(date) && parts.hour * 60 + parts.minute >= marketCloseMinutes(date) + providerDelayMinutesAfterClose
    ? date : previousUsTradingDate(date);
};
export const lastExpectedTradingDate = latestCompletedTradingDate;
export const shouldRunAfterClose = (now = new Date(), providerDelayMinutesAfterClose = 45) =>
  latestCompletedTradingDate(now, providerDelayMinutesAfterClose) === formatDateInZone(now);
