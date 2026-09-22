export type ValidationCode =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'min'
  | 'max'
  | 'invalidNumber'
  | 'custom';

export interface ValidationIssue {
  code: ValidationCode;
  message: string;
}

export interface TextValidationRules {
  required?: string;
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  pattern?: { value: RegExp; message: string };
}

export interface NumberValidationRules {
  required?: string;
  min?: { value: number; message: string };
  max?: { value: number; message: string };
}

export interface FieldErrorSnapshot {
  name: string;
  order: number;
  message?: string;
}

export type ExpoBaseDateValue = string;
export type ExpoBaseTimeValue = string;
export interface ExpoBaseDateRangeValue { start: ExpoBaseDateValue; end: ExpoBaseDateValue; }
export interface ExpoBaseDateConstraints { required?: string; min?: ExpoBaseDateValue; max?: ExpoBaseDateValue; invalid?: string; }

export function validateEmail(value: string, message = 'Enter a valid email address.'): ValidationIssue | null {
  const normalized = value.trim();
  return !normalized || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? null : { code: 'pattern', message };
}

export function validateUrl(value: string, message = 'Enter a valid URL.'): ValidationIssue | null {
  const normalized = value.trim();
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : { code: 'pattern', message };
  } catch {
    return { code: 'pattern', message };
  }
}

/** Generic normalization only. Country/region-specific phone policy remains product-owned. */
export function normalizePhoneInput(value: string): string {
  const normalized = value.trim().replace(/[\s().-]/g, '');
  return normalized.startsWith('+') ? `+${normalized.slice(1).replace(/\D/g, '')}` : normalized.replace(/\D/g, '');
}

export function validateInternationalPhone(value: string, message = 'Enter a valid phone number.'): ValidationIssue | null {
  const normalized = normalizePhoneInput(value);
  return !normalized || /^\+?[0-9]{7,15}$/.test(normalized) ? null : { code: 'pattern', message };
}

/** A transport-neutral ISO calendar date contract; native/calendar picker UI remains optional. */
export function parseExpoBaseDateValue(value: string): string | null {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === normalized ? normalized : null;
}

/** Parses a timezone-free wall-clock value using a canonical 24-hour HH:mm transport shape. */
export function parseExpoBaseTimeValue(value: string): ExpoBaseTimeValue | null {
  const normalized = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 ? normalized : null;
}

export function parseExpoBaseDateRange(start: string, end: string): ExpoBaseDateRangeValue | null {
  const parsedStart = parseExpoBaseDateValue(start);
  const parsedEnd = parseExpoBaseDateValue(end);
  return parsedStart && parsedEnd && parsedStart <= parsedEnd ? { start: parsedStart, end: parsedEnd } : null;
}

export function validateExpoBaseDateValue(value: string, constraints: ExpoBaseDateConstraints = {}): ValidationIssue | null {
  const normalized = value.trim();
  if (!normalized) return constraints.required ? { code: 'required', message: constraints.required } : null;
  const parsed = parseExpoBaseDateValue(normalized);
  if (!parsed) return { code: 'custom', message: constraints.invalid ?? 'Enter a valid date in YYYY-MM-DD format.' };
  if (constraints.min && parsed < constraints.min) return { code: 'min', message: `Choose ${constraints.min} or later.` };
  if (constraints.max && parsed > constraints.max) return { code: 'max', message: `Choose ${constraints.max} or earlier.` };
  return null;
}

/** Formats a calendar date without translating it through the device timezone. */
export function formatExpoBaseCalendarDate(value: string, locale: string, options: Intl.DateTimeFormatOptions = {}): string {
  const parsed = parseExpoBaseDateValue(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric', ...options }).format(new Date(`${parsed}T00:00:00.000Z`));
}

/** Formats a timezone-free wall-clock value according to the locale's 12/24-hour preference. */
export function formatExpoBaseTimeValue(value: string, locale: string, options: Intl.DateTimeFormatOptions = {}): string {
  const parsed = parseExpoBaseTimeValue(value);
  if (!parsed) return '—';
  const [hours = '0', minutes = '0'] = parsed.split(':');
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', ...options }).format(new Date(Date.UTC(2000, 0, 1, Number(hours), Number(minutes))));
}

export function validateText(value: string, rules: TextValidationRules): ValidationIssue | null {
  const normalized = value.trim();
  if (rules.required && normalized.length === 0) return { code: 'required', message: rules.required };
  if (rules.minLength && normalized.length < rules.minLength.value) return { code: 'minLength', message: rules.minLength.message };
  if (rules.maxLength && normalized.length > rules.maxLength.value) return { code: 'maxLength', message: rules.maxLength.message };
  if (rules.pattern && normalized.length > 0 && !rules.pattern.value.test(normalized)) return { code: 'pattern', message: rules.pattern.message };
  return null;
}

export function parseDecimalInput(value: string): number | null {
  const normalized = value.replace(/[^0-9+\-.]/g, '');
  if (!normalized || normalized === '-' || normalized === '+' || normalized === '.' || normalized === '-.' || normalized === '+.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateNumber(value: string | number | null | undefined, rules: NumberValidationRules): ValidationIssue | null {
  if (value === null || value === undefined || value === '') {
    return rules.required ? { code: 'required', message: rules.required } : null;
  }
  const parsed = typeof value === 'number' ? value : parseDecimalInput(value);
  if (parsed === null) return { code: 'invalidNumber', message: 'Enter a valid number.' };
  if (rules.min && parsed < rules.min.value) return { code: 'min', message: rules.min.message };
  if (rules.max && parsed > rules.max.value) return { code: 'max', message: rules.max.message };
  return null;
}

export function firstInvalidField(fields: readonly FieldErrorSnapshot[]): FieldErrorSnapshot | null {
  return [...fields]
    .filter((field) => Boolean(field.message))
    .sort((a, b) => a.order - b.order)[0] ?? null;
}

export function formatCurrencyInput(value: string, fractionDigits = 2): string {
  const parsed = parseDecimalInput(value);
  if (parsed === null) return '';
  const safeDigits = Math.max(0, Math.min(6, Math.trunc(fractionDigits)));
  return parsed.toFixed(safeDigits);
}
