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
    hour12: false,
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

const usMarketHolidaySet = (year: number) => {
  const holidays = [
    observedIfWeekend(new Date(Date.UTC(year, 0, 1))),
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
  return new Set(holidays.map((holiday) => holiday.toISOString().slice(0, 10)));
};

export const isUsTradingDay = (date: Date) => {
  const parts = getZonedParts(date);
  const zonedUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const weekday = zonedUtc.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !usMarketHolidaySet(parts.year).has(zonedUtc.toISOString().slice(0, 10));
};

export const previousUsTradingDay = (date: Date) => {
  const cursor = new Date(date);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (!isUsTradingDay(cursor)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return cursor;
};

export const latestCompletedTradingDate = (
  now = new Date(),
  providerDelayMinutesAfterClose = 45,
) => {
  const parts = getZonedParts(now);
  const localMarketDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const currentTradingDay = isUsTradingDay(localMarketDate);
  const minutesAfterMidnight = parts.hour * 60 + parts.minute;
  const cutoff = MARKET_CLOSE_HOUR * 60 + providerDelayMinutesAfterClose;
  const effectiveDate =
    currentTradingDay && minutesAfterMidnight >= cutoff
      ? localMarketDate
      : previousUsTradingDay(localMarketDate);
  return effectiveDate.toISOString().slice(0, 10);
};

export const lastExpectedTradingDate = latestCompletedTradingDate;

export const shouldRunAfterClose = (
  now = new Date(),
  providerDelayMinutesAfterClose = 45,
) => latestCompletedTradingDate(now, providerDelayMinutesAfterClose) === formatDateInZone(now);

