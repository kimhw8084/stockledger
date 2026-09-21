export type ExpoBaseDirection = 'ltr' | 'rtl';
export type ExpoBaseDirectionPreference = ExpoBaseDirection | 'auto';
export type ExpoBaseMessageValues = Readonly<Record<string, string | number | Date | null | undefined>>;

export interface ExpoBasePluralMessage {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type ExpoBaseMessage = string | ExpoBasePluralMessage;
export type ExpoBaseMessageCatalog = Readonly<Record<string, Readonly<Record<string, ExpoBaseMessage>>>>;

const DEFAULT_LOCALE = 'en-US';
const RTL_LANGUAGES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ks', 'ku', 'nqo', 'ps', 'sd', 'ug', 'ur', 'yi']);
const PSEUDO_LOCALES = new Set(['en-XA', 'en-XB']);

export function normalizeExpoBaseLocale(locale: string | undefined, fallbackLocale = DEFAULT_LOCALE): string {
  const raw = locale?.trim().replaceAll('_', '-');
  if (!raw) return normalizeExpoBaseLocale(fallbackLocale, DEFAULT_LOCALE);
  const pseudo = [...PSEUDO_LOCALES].find((candidate) => candidate.toLowerCase() === raw.toLowerCase());
  if (pseudo) return pseudo;
  try {
    return Intl.getCanonicalLocales(raw)[0] ?? normalizeExpoBaseLocale(fallbackLocale, DEFAULT_LOCALE);
  } catch {
    return fallbackLocale === DEFAULT_LOCALE ? DEFAULT_LOCALE : normalizeExpoBaseLocale(fallbackLocale, DEFAULT_LOCALE);
  }
}

export function detectExpoBaseLocale(fallbackLocale = DEFAULT_LOCALE): string {
  try {
    return normalizeExpoBaseLocale(Intl.DateTimeFormat().resolvedOptions().locale, fallbackLocale);
  } catch {
    return normalizeExpoBaseLocale(fallbackLocale);
  }
}

export function expoBaseLocaleDirection(locale: string): ExpoBaseDirection {
  if (normalizeExpoBaseLocale(locale) === 'en-XB') return 'rtl';
  return RTL_LANGUAGES.has(normalizeExpoBaseLocale(locale).split('-')[0] ?? '') ? 'rtl' : 'ltr';
}

export function isExpoBasePseudoLocale(locale: string): boolean {
  return PSEUDO_LOCALES.has(normalizeExpoBaseLocale(locale));
}

export function pseudoLocalize(message: string, direction: ExpoBaseDirection = 'ltr'): string {
  const expanded = message.replace(/[A-Za-z]/g, (character) => {
    const lower = character.toLowerCase();
    return 'aeiou'.includes(lower) ? `${character}${character}` : character;
  });
  return direction === 'rtl' ? `\u202e［${expanded}］\u202c` : `［${expanded}］`;
}

export function formatExpoBaseMessage(
  message: ExpoBaseMessage,
  locale: string,
  values: ExpoBaseMessageValues = {},
): string {
  const template = typeof message === 'string' ? message : selectPluralMessage(message, locale, values.count);
  return template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_, key: string) => formatMessageValue(values[key]));
}

export function resolveExpoBaseMessage(
  catalog: ExpoBaseMessageCatalog | undefined,
  key: string,
  locale: string,
  fallbackLocale: string,
): ExpoBaseMessage | undefined {
  if (!catalog) return undefined;
  for (const candidate of localeCandidates(locale, fallbackLocale)) {
    const catalogLocale = Object.keys(catalog).find((entry) => normalizeExpoBaseLocale(entry) === candidate);
    const message = catalogLocale ? catalog[catalogLocale]?.[key] : undefined;
    if (message) return message;
  }
  return undefined;
}

export function formatExpoBaseNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return Number.isFinite(value) ? new Intl.NumberFormat(locale, options).format(value) : '—';
}

export function formatExpoBaseCurrency(value: number, currency: string, locale: string, options?: Intl.NumberFormatOptions): string {
  return formatExpoBaseNumber(value, locale, { style: 'currency', currency, ...options });
}

export function formatExpoBasePercent(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return formatExpoBaseNumber(value, locale, { style: 'percent', ...options });
}

/**
 * Parses a user-editable decimal with the separators for `locale`.
 *
 * This intentionally returns `null` for empty and partial values (for example
 * `-` or `12,`): a field can preserve the user's string while exposing that it
 * does not yet have a committed numeric value. It is not a currency parser and
 * does not attempt to infer a product's currency or accounting conventions.
 */
export function parseExpoBaseDecimalInput(value: string, locale: string): number | null {
  const symbols = expoBaseNumberSymbols(locale);
  const normalized = normalizeExpoBaseDigits(value)
    .replaceAll(symbols.group, '')
    .replaceAll(symbols.decimal, '.')
    .replaceAll(symbols.minus, '-')
    .replace(/[\u2212\u2010-\u2015]/g, '-')
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/[^0-9+-.]/g, '');

  if (!/^[-+]?\d*(?:\.\d*)?$/.test(normalized) || !/\d/.test(normalized) || normalized.endsWith('.')) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Formats a committed number for editable number/currency fields on blur. */
export function formatExpoBaseEditableNumber(
  value: number,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return Number.isFinite(value)
    ? new Intl.NumberFormat(locale, { useGrouping: true, ...options }).format(value)
    : '';
}

/** Exposes locale separators for specialized editing experiences without UI code reimplementing Intl parts. */
export function expoBaseNumberSymbols(locale: string): { decimal: string; group: string; minus: string } {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(-12345.6);
    return {
      decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
      group: parts.find((part) => part.type === 'group')?.value ?? ',',
      minus: parts.find((part) => part.type === 'minusSign')?.value ?? '-',
    };
  } catch {
    return { decimal: '.', group: ',', minus: '-' };
  }
}

export function formatExpoBaseDate(value: Date | number | string, locale: string, options?: Intl.DateTimeFormatOptions): string {
  const date = toValidDate(value);
  return date ? new Intl.DateTimeFormat(locale, options).format(date) : '—';
}

export function compareExpoBaseLocale(left: string, right: string, locale: string, options?: Intl.CollatorOptions): number {
  return new Intl.Collator(locale, { numeric: true, sensitivity: 'base', ...options }).compare(left, right);
}

export function detectExpoBaseTimeZone(): string | undefined {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone || undefined;
  } catch {
    return undefined;
  }
}

function localeCandidates(locale: string, fallbackLocale: string): readonly string[] {
  const normalized = normalizeExpoBaseLocale(locale, fallbackLocale);
  const fallback = normalizeExpoBaseLocale(fallbackLocale);
  const candidates = isExpoBasePseudoLocale(normalized) ? [fallback] : [normalized, normalized.split('-')[0] ?? normalized, fallback, fallback.split('-')[0] ?? fallback];
  return [...new Set(candidates)];
}

function selectPluralMessage(message: ExpoBasePluralMessage, locale: string, count: ExpoBaseMessageValues['count']): string {
  const numericCount = typeof count === 'number' ? count : Number(count);
  if (numericCount === 0 && message.zero) return message.zero;
  const category = Number.isFinite(numericCount) ? new Intl.PluralRules(locale).select(numericCount) : 'other';
  return message[category] ?? message.other;
}

function formatMessageValue(value: ExpoBaseMessageValues[string]): string {
  if (value instanceof Date) return value.toISOString();
  return value === null || value === undefined ? '' : String(value);
}

function normalizeExpoBaseDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function toValidDate(value: Date | number | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
