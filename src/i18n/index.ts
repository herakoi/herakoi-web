import { detectBrowserLocale, isLocale, setLocale } from "#src/shared/i18n";
import { useAppConfigStore } from "#src/state/appConfigStore";

/**
 * Show the app in the saved language, or the browser's when none is saved,
 * and follow later changes to the preference.
 */
export const startLocaleSync = () => {
  // A stored value that is no longer supported falls back to the browser's language.
  const apply = (language: unknown) =>
    setLocale(isLocale(language) ? language : detectBrowserLocale());

  apply(useAppConfigStore.getState().uiPreferences.language);
  return useAppConfigStore.subscribe((state, previous) => {
    if (state.uiPreferences.language !== previous.uiPreferences.language) {
      apply(state.uiPreferences.language);
    }
  });
};
