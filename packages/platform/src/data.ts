export interface DataColumnContract { key: string; label: string; primary?: boolean; }
export interface DataColumnValidation { valid: boolean; violations: string[]; }

export function validateDataColumns(columns: readonly DataColumnContract[]): DataColumnValidation {
  const violations: string[] = [];
  if (columns.length === 0) violations.push('A data view requires at least one column.');
  const seen = new Set<string>();
  let primaryCount = 0;
  for (const column of columns) {
    if (!column.key.trim()) violations.push('Column keys must be non-empty.');
    if (!column.label.trim()) violations.push(`Column "${column.key}" requires a visible label.`);
    if (seen.has(column.key)) violations.push(`Duplicate column key: ${column.key}`);
    seen.add(column.key);
    if (column.primary) primaryCount += 1;
  }
  if (primaryCount > 1) violations.push('Only one column may be marked primary.');
  return { valid: violations.length === 0, violations };
}

export function paginationWindow(currentPage: number, pageCount: number, visibleCount = 5): number[] {
  const total = Math.max(1, Math.trunc(pageCount));
  const count = Math.max(1, Math.min(total, Math.trunc(visibleCount)));
  const current = Math.max(1, Math.min(total, Math.trunc(currentPage)));
  let start = current - Math.floor(count / 2);
  start = Math.max(1, Math.min(start, total - count + 1));
  return Array.from({ length: count }, (_, index) => start + index);
}

export function formatCurrency(value: number, currency = 'USD', locale = 'en-US'): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number, locale = 'en-US', fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: Math.max(0, Math.min(4, Math.trunc(fractionDigits))) }).format(value);
}

export function formatCompactNumber(value: number, locale = 'en-US'): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export interface ExpoBaseDelimitedDataColumn<Row> {
  key: string;
  label: string;
  value: (row: Row) => string | number | boolean | null | undefined;
}

export interface ExpoBaseDelimitedDataOptions {
  delimiter?: ',' | '\t' | ';';
  lineEnding?: '\n' | '\r\n';
  includeHeader?: boolean;
}

export function serializeExpoBaseDelimitedData<Row>(rows: readonly Row[], columns: readonly ExpoBaseDelimitedDataColumn<Row>[], options: ExpoBaseDelimitedDataOptions = {}): string {
  if (columns.length === 0) return '';
  const delimiter = options.delimiter ?? ',';
  const lineEnding = options.lineEnding ?? '\n';
  const lines: string[] = [];
  if (options.includeHeader !== false) lines.push(columns.map((column) => escapeDelimitedCell(column.label, delimiter)).join(delimiter));
  for (const row of rows) lines.push(columns.map((column) => escapeDelimitedCell(normalizeDelimitedCell(column.value(row)), delimiter)).join(delimiter));
  return lines.join(lineEnding);
}

function normalizeDelimitedCell(value: string | number | boolean | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function escapeDelimitedCell(value: string, delimiter: string): string {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
