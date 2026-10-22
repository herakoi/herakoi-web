import { createInstance } from "i18next";
import { useCallback } from "react";
import { initReactI18next, useTranslation } from "react-i18next";
import { defaultLocale, type Locale, type Messages, supportedLocales } from "#src/core/i18n";

/**
 * The app's i18next instance. It starts in English with no texts; each namespace (the shell,
 * shared components, every plugin id) adds its own through `createTranslation`.
 * Keys are flat (dots are part of the key) and the namespace is always explicit.
 */
export const i18n = createInstance();

void i18n.use(initReactI18next).init({
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  supportedLngs: [...supportedLocales],
  resources: {},
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false,
});

type TranslationValues = Record<string, string | number>;

export type Translate<TKeys extends string> = (key: TKeys, values?: TranslationValues) => string;

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
export const currentLocale = (): Locale =>
  isLocale(i18n.language) ? i18n.language : defaultLocale;

/** Show the app in `locale` and mark the document with it. */
export const setLocale = (locale: Locale) => {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
  if (typeof document !== "undefined") document.documentElement.lang = locale;
};

/** Re-renders the caller when the language changes and returns the current locale. */
export const useLocale = (): Locale => {
  useTranslation(undefined, { i18n });
  return currentLocale();
};

/**
 * Register a namespace's messages and bind typed translate functions to it:
 * `useT` re-renders on language change, `t` serves code outside React.
 */
export const createTranslation = <TKeys extends string>(
  namespace: string,
  messages: Messages<TKeys>,
) => {
  for (const locale of supportedLocales) {
    i18n.addResourceBundle(locale, namespace, messages[locale], true, true);
  }

  const t: Translate<TKeys> = (key, values) => i18n.t(key, { ns: namespace, ...values });

  const useT = (): Translate<TKeys> => {
    const { t: translate } = useTranslation(namespace, { i18n });
    return useCallback<Translate<TKeys>>(
      (key, values) => translate(key, { ns: namespace, ...values }),
      [translate, namespace],
    );
  };

  return { t, useT };
};

/** A plugin's name in the current language: its `displayName` message, or the declared name. */
export const usePluginName = () => {
  const { t } = useTranslation(undefined, { i18n });
  return useCallback(
    (plugin: { id: string; displayName: string }) =>
      t("displayName", { ns: plugin.id, defaultValue: plugin.displayName }),
    [t],
  );
};

/**
 * Text for an error shown to the user: the first `errors.<name>` message found in the given
 * namespaces, or the error's own (English) message when there is no translation.
 */
export const useErrorText = (namespaces: string | readonly string[]) => {
  const { t } = useTranslation(undefined, { i18n });
  return useCallback(
    (error: Error) =>
      t(`errors.${error.name}`, { ns: namespaces as string[], defaultValue: error.message }),
    [t, namespaces],
  );
};
