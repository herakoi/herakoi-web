/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkForUpdate } from "#src/lib/pwa";
import { AppUpdateSection } from "./AppUpdateSection";

vi.mock("#src/lib/pwa", () => ({
  appVersion: { version: "1.2.3", commit: "abc1234" },
  checkForUpdate: vi.fn(),
}));

describe("AppUpdateSection", () => {
  afterEach(cleanup);

  it("shows the running version and commit", () => {
    render(<AppUpdateSection />);
    expect(screen.getByText(/1\.2\.3/).textContent).toContain("abc1234");
  });

  it.each([
    ["upToDate", "You have the latest version."],
    ["updating", "Updating: the app will reload by itself."],
    ["unavailable", "Updates are not available in this browser."],
    ["failed", "Could not check for updates. Are you offline?"],
  ] as const)("announces the %s result", async (result, message) => {
    vi.mocked(checkForUpdate).mockResolvedValueOnce(result);
    render(<AppUpdateSection />);
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(await screen.findByText(message)).toBeTruthy();
  });
});
