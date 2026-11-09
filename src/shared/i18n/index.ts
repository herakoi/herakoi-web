import { useCallback, useSyncExternalStore } from "react";
import {
  defaultLocale,
  type Locale,
  type MessageCatalog,
  type Messages,
  supportedLocales,
} from "#src/core/i18n";

/**
 * The app's texts, by locale and namespace. Each namespace (the shell, shared components, every
 * plugin id) adds its own through `createTranslation`. Keys are flat: dots are part of the key.
 */
const catalogs = Object.fromEntries(supportedLocales.map((locale) => [locale, {}])) as Record<
  Locale,
  Record<string, MessageCatalog>
>;

let activeLocale: Locale = defaultLocale;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

type TranslationValues = Record<string, string | number>;

export type Translate<TKeys extends string> = (key: TKeys, values?: TranslationValues) => string;

/** Replaces each `{{name}}` with its value; a name without a value stays as written. */
const interpolate = (text: string, values?: TranslationValues) =>
  values
    ? text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (placeholder, name: string) =>
        name in values ? String(values[name]) : placeholder,
      )
    : text;

/**
 * The text of `key` in `locale`: the first namespace that has it wins, and within a namespace a
 * missing translation falls back to English. Without a match, `fallback` or the key itself.
 */
const translate = (
  locale: Locale,
  namespaces: readonly string[],
  key: string,
  values?: TranslationValues,
  fallback?: string,
) => {
  const locales = locale === defaultLocale ? [locale] : [locale, defaultLocale];
  for (const namespace of namespaces) {
    for (const candidate of locales) {
      const text = catalogs[candidate][namespace]?.[key];
      if (text !== undefined) return interpolate(text, values);
    }
  }
  return interpolate(fallback ?? key, values);
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (supportedLocales as readonly string[]).includes(value);

/** First supported language among the browser's preferences, English otherwise. */
export const detectBrowserLocale = (): Locale => {
  if (typeof navigator === "undefined") return defaultLocale;
  const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const language of preferences) {
    const base = language?.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
};

/** The locale currently shown. */
export const currentLocale = (): Locale => activeLocale;

/** Show the app in `locale` and mark the document with it. */
export const setLocale = (locale: Locale) => {
  if (activeLocale !== locale) {
    activeLocale = locale;
    for (const listener of listeners) listener();
  }
  if (typeof document !== "undefined") document.documentElement.lang = locale;
};

/** Re-renders the caller when the language changes and returns the current locale. */
export const useLocale = (): Locale =>
  useSyncExternalStore(subscribe, currentLocale, currentLocale);

/**
 * Register a namespace's messages and bind typed translate functions to it:
 * `useT` re-renders on language change, `t` serves code outside React.
 */
export const createTranslation = <TKeys extends string>(
  namespace: string,
  messages: Messages<TKeys>,
) => {
  for (const locale of supportedLocales) {
    catalogs[locale][namespace] = { ...catalogs[locale][namespace], ...messages[locale] };
  }
  const namespaces = [namespace];

  const t: Translate<TKeys> = (key, values) => translate(activeLocale, namespaces, key, values);

  const useT = (): Translate<TKeys> => {
    const locale = useLocale();
    return useCallback<Translate<TKeys>>(
      (key, values) => translate(locale, namespaces, key, values),
      [locale],
    );
  };

  return { t, useT };
};

/** A plugin's name in the current language: its `displayName` message, or the declared name. */
export const usePluginName = () => {
  const locale = useLocale();
  return useCallback(
    (plugin: { id: string; displayName: string }) =>
      translate(locale, [plugin.id], "displayName", undefined, plugin.displayName),
    [locale],
  );
};

/**
 * Text for an error shown to the user: the first `errors.<name>` message found in the given
 * namespaces, or the error's own (English) message when there is no translation.
 */
export const useErrorText = (namespaces: string | readonly string[]) => {
  const locale = useLocale();
  return useCallback(
    (error: Error) =>
      translate(
        locale,
        typeof namespaces === "string" ? [namespaces] : namespaces,
        `errors.${error.name}`,
        undefined,
        error.message,
      ),
    [locale, namespaces],
  );
};
