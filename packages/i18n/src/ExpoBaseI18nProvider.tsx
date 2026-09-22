import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import { Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  compareExpoBaseLocale,
  detectExpoBaseLocale,
  detectExpoBaseTimeZone,
  formatExpoBaseCurrency,
  formatExpoBaseDate,
  formatExpoBaseMessage,
  formatExpoBaseNumber,
  formatExpoBasePercent,
  isExpoBasePseudoLocale,
  normalizeExpoBaseLocale,
  expoBaseLocaleDirection,
  pseudoLocalize,
  resolveExpoBaseMessage,
  type ExpoBaseDirection,
  type ExpoBaseDirectionPreference,
  type ExpoBaseMessageCatalog,
  type ExpoBaseMessageValues,
} from './locale';

export interface ExpoBaseI18nOptions {
  locale?: string;
  fallbackLocale?: string;
  direction?: ExpoBaseDirectionPreference;
  timeZone?: string;
  messages?: ExpoBaseMessageCatalog;
}

export interface ExpoBaseI18nValue {
  locale: string;
  fallbackLocale: string;
  direction: ExpoBaseDirection;
  timeZone?: string;
  pseudoLocale: boolean;
  t: (key: string, values?: ExpoBaseMessageValues, fallback?: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency: string, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  compare: (left: string, right: string, options?: Intl.CollatorOptions) => number;
}

const defaultValue: ExpoBaseI18nValue = createValue({ locale: detectExpoBaseLocale() });
const ExpoBaseI18nContext = createContext<ExpoBaseI18nValue>(defaultValue);

export function ExpoBaseI18nProvider({ children, ...options }: PropsWithChildren<ExpoBaseI18nOptions>) {
  const value = useMemo(() => createValue(options), [options.direction, options.fallbackLocale, options.locale, options.messages, options.timeZone]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const target = globalThis as unknown as { document?: { documentElement?: { dir: string; lang: string } } };
    const root = target.document?.documentElement;
    if (!root) return;
    const previous = { dir: root.dir, lang: root.lang };
    root.dir = value.direction;
    root.lang = value.locale;
    return () => {
      root.dir = previous.dir;
      root.lang = previous.lang;
    };
  }, [value.direction, value.locale]);

  return (
    <ExpoBaseI18nContext.Provider value={value}>
      <View style={[styles.root, value.direction === 'rtl' ? styles.rtl : styles.ltr]}>{children}</View>
    </ExpoBaseI18nContext.Provider>
  );
}

export function useExpoBaseI18n(): ExpoBaseI18nValue {
  return useContext(ExpoBaseI18nContext);
}

export function useExpoBaseDirection(): ExpoBaseDirection {
  return useExpoBaseI18n().direction;
}

function createValue(options: ExpoBaseI18nOptions): ExpoBaseI18nValue {
  const fallbackLocale = normalizeExpoBaseLocale(options.fallbackLocale ?? 'en-US');
  const locale = normalizeExpoBaseLocale(options.locale ?? detectExpoBaseLocale(fallbackLocale), fallbackLocale);
  const direction = options.direction && options.direction !== 'auto' ? options.direction : expoBaseLocaleDirection(locale);
  const pseudoLocale = isExpoBasePseudoLocale(locale);
  const timeZone = options.timeZone ?? detectExpoBaseTimeZone();
  const formatDate = (value: Date | number | string, dateOptions?: Intl.DateTimeFormatOptions) => formatExpoBaseDate(value, locale, timeZone ? { timeZone, ...dateOptions } : dateOptions);

  return {
    locale,
    fallbackLocale,
    direction,
    ...(timeZone ? { timeZone } : {}),
    pseudoLocale,
    t: (key, values, fallback) => {
      const message = resolveExpoBaseMessage(options.messages, key, locale, fallbackLocale) ?? fallback ?? key;
      const localized = formatExpoBaseMessage(message, locale, values);
      return pseudoLocale ? pseudoLocalize(localized, direction) : localized;
    },
    formatNumber: (value, formatOptions) => formatExpoBaseNumber(value, locale, formatOptions),
    formatCurrency: (value, currency, formatOptions) => formatExpoBaseCurrency(value, currency, locale, formatOptions),
    formatPercent: (value, formatOptions) => formatExpoBasePercent(value, locale, formatOptions),
    formatDate,
    compare: (left, right, collatorOptions) => compareExpoBaseLocale(left, right, locale, collatorOptions),
  };
}

const styles = StyleSheet.create(() => ({
  root: { flex: 1, minWidth: 0 },
  ltr: { direction: 'ltr' },
  rtl: { direction: 'rtl' },
}));
