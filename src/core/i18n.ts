/**
 * Localization contract shared by the shell and plugins.
 *
 * English is the reference language: every other locale must translate the same keys,
 * which `defineMessages` checks at compile time.
 */

export const supportedLocales = ["en", "it"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en";

/** Each locale's name in its own language, as shown in the language selector. */
export const localeNames: Record<Locale, string> = { en: "English", it: "Italiano" };

/** Flat key → text map for one locale. Values may use `{{name}}` interpolation. */
export type MessageCatalog = Record<string, string>;

/** A namespace's texts in every supported locale, with the English keys as reference. */
export type Messages<TKeys extends string = string> = Record<Locale, Record<TKeys, string>>;

/**
 * Declare a namespace's translations. TypeScript rejects a locale that misses an English key.
 *
 * In a plugin's messages, a `displayName` key translates the plugin's name wherever the shell
 * shows it.
 */
export const defineMessages = <const TEnglish extends MessageCatalog>(
  messages: {
    en: TEnglish;
  } & Record<Exclude<Locale, "en">, Record<keyof TEnglish, string>>,
): Messages<keyof TEnglish & string> => messages as Messages<keyof TEnglish & string>;
