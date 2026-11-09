/**
 * @vitest-environment happy-dom
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineMessages } from "#src/core/i18n";
import {
  createTranslation,
  detectBrowserLocale,
  setLocale,
  useErrorText,
  useLocale,
  usePluginName,
} from "./index";

const messages = defineMessages({
  en: { displayName: "Test plugin", greeting: "Hello {{name}}", "errors.BrokenError": "Broken" },
  it: { displayName: "Plugin di prova", greeting: "Ciao {{name}}", "errors.BrokenError": "Rotto" },
});
const { t, useT } = createTranslation("test/plugin", messages);

class BrokenError extends Error {
  name = "BrokenError";
}
class UnknownError extends Error {
  name = "UnknownError";
}

const Greeting = () => {
  const translate = useT();
  const pluginName = usePluginName();
  const errorText = useErrorText("test/plugin");
  return (
    <>
      <p>{translate("greeting", { name: "Ada" })}</p>
      <p>{pluginName({ id: "test/plugin", displayName: "Fallback" })}</p>
      <p>{pluginName({ id: "test/no-messages", displayName: "Declared name" })}</p>
      <p>{errorText(new BrokenError("broken"))}</p>
      <p>{errorText(new UnknownError("English message"))}</p>
    </>
  );
};

describe("i18n", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    act(() => setLocale("en"));
  });

  it("translates a namespace and follows language changes", () => {
    render(<Greeting />);
    expect(screen.getByText("Hello Ada")).toBeTruthy();
    expect(screen.getByText("Test plugin")).toBeTruthy();
    expect(screen.getByText("Broken")).toBeTruthy();

    act(() => setLocale("it"));
    expect(screen.getByText("Ciao Ada")).toBeTruthy();
    expect(screen.getByText("Plugin di prova")).toBeTruthy();
    expect(screen.getByText("Rotto")).toBeTruthy();
    expect(document.documentElement.lang).toBe("it");
    expect(t("greeting", { name: "Bo" })).toBe("Ciao Bo");
  });

  it("falls back to the declared name and the error's own message", () => {
    act(() => setLocale("it"));
    render(<Greeting />);
    expect(screen.getByText("Declared name")).toBeTruthy();
    expect(screen.getByText("English message")).toBeTruthy();
  });

  it("reports the current locale and re-renders on change", () => {
    const Locale = () => <p>locale: {useLocale()}</p>;
    render(<Locale />);
    expect(screen.getByText("locale: en")).toBeTruthy();
    act(() => setLocale("it"));
    expect(screen.getByText("locale: it")).toBeTruthy();
  });

  it("interpolates numbers and repeated names, and leaves unknown ones as written", () => {
    const { t: translate } = createTranslation(
      "test/interpolation",
      defineMessages({
        en: { score: "{{who}} has {{count}} points, {{who}}!", unknown: "Hi {{missing}}" },
        it: { score: "{{who}} ha {{count}} punti, {{who}}!", unknown: "Ciao {{missing}}" },
      }),
    );
    expect(translate("score", { who: "Ada", count: 3 })).toBe("Ada has 3 points, Ada!");
    expect(translate("unknown")).toBe("Hi {{missing}}");
  });

  it("falls back to English for a text missing in the current locale, then to the key", () => {
    const { t: translate } = createTranslation("test/partial", {
      en: { onlyEnglish: "Only English" },
      it: {} as { onlyEnglish: string },
    });
    act(() => setLocale("it"));
    expect(translate("onlyEnglish")).toBe("Only English");
    expect(translate("absent" as "onlyEnglish")).toBe("absent");
  });

  it("finds an error text in the first namespace that has it", () => {
    createTranslation(
      "test/other",
      defineMessages({
        en: { "errors.OtherError": "Other" },
        it: { "errors.OtherError": "Altro" },
      }),
    );
    class OtherError extends Error {
      name = "OtherError";
    }
    const Errors = () => {
      const errorText = useErrorText(["test/plugin", "test/other"]);
      return <p>{errorText(new OtherError("other"))}</p>;
    };
    render(<Errors />);
    expect(screen.getByText("Other")).toBeTruthy();
  });

  it("rejects at compile time a locale that misses an English key", () => {
    defineMessages({
      en: { title: "Title", subtitle: "Subtitle" },
      // @ts-expect-error: the Italian catalog lacks "subtitle"
      it: { title: "Titolo" },
    });
  });

  it("picks the first supported browser language, English otherwise", () => {
    const languages = vi.spyOn(navigator, "languages", "get");
    languages.mockReturnValue(["fr-FR", "it-IT", "en-US"]);
    expect(detectBrowserLocale()).toBe("it");
    languages.mockReturnValue(["de-DE", "fr-FR"]);
    expect(detectBrowserLocale()).toBe("en");
  });
});
