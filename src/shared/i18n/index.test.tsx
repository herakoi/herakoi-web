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
