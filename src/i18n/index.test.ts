/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentLocale, setLocale } from "#src/shared/i18n";
import { useAppConfigStore } from "#src/state/appConfigStore";
import { APP_CONFIG_KEY } from "#src/state/persistenceKeys";
import { startLocaleSync } from "./index";

const mockBrowserLanguages = (languages: string[]) =>
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);

describe("startLocaleSync", () => {
  let stop: (() => void) | undefined;

  beforeEach(() => {
    useAppConfigStore.getState().resetAll();
    setLocale("en");
  });

  afterEach(() => {
    stop?.();
    vi.restoreAllMocks();
    localStorage.removeItem(APP_CONFIG_KEY);
  });

  it("uses the browser's language when none is saved", () => {
    mockBrowserLanguages(["it-IT", "en"]);
    stop = startLocaleSync();
    expect(currentLocale()).toBe("it");
    expect(document.documentElement.lang).toBe("it");
  });

  it("restores the saved language after a reload, over the browser's", async () => {
    mockBrowserLanguages(["en-US"]);
    useAppConfigStore.getState().setUiPreferences({ language: "it" });
    await useAppConfigStore.persist.rehydrate();

    stop = startLocaleSync();
    expect(currentLocale()).toBe("it");
  });

  it("falls back to the browser's language for an unsupported saved value", () => {
    mockBrowserLanguages(["en-US"]);
    useAppConfigStore.setState((state) => ({
      uiPreferences: { ...state.uiPreferences, language: "fr" as never },
    }));
    stop = startLocaleSync();
    expect(currentLocale()).toBe("en");
  });

  it("follows later changes to the preference", () => {
    mockBrowserLanguages(["en-US"]);
    stop = startLocaleSync();
    expect(currentLocale()).toBe("en");

    useAppConfigStore.getState().setUiPreferences({ language: "it" });
    expect(currentLocale()).toBe("it");

    useAppConfigStore.getState().resetAll();
    expect(currentLocale()).toBe("en");
  });
});
