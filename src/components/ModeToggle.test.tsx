/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Hand, MousePointer2 } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppConfigStore } from "#src/state/appConfigStore";
import { ModeToggle } from "./ModeToggle";

const options = [
  { pluginId: "detection/mediapipe", label: "Hand tracking", icon: Hand },
  { pluginId: "detection/pointer", label: "Mouse / touch", icon: MousePointer2 },
];

// Mirrors the shell's switch handler, which ends by writing the store.
const onSelect = vi.fn((pluginId: string) =>
  useAppConfigStore.getState().setActivePlugin("detection", pluginId),
);

const renderToggle = () =>
  render(
    <ModeToggle slot="detection" label="Detection mode" options={options} onSelect={onSelect} />,
  );

const liveRegion = (container: HTMLElement) => container.querySelector("[aria-live]");

describe("ModeToggle", () => {
  beforeEach(() => {
    onSelect.mockClear();
    useAppConfigStore.getState().setActivePlugin("detection", "detection/mediapipe");
  });

  afterEach(cleanup);

  it("stays clickable inside pointer-events-none containers", () => {
    renderToggle();
    expect(screen.getByRole("group", { name: "Detection mode" }).className).toContain(
      "pointer-events-auto",
    );
  });

  it("describes what the toggle switches for screen readers", () => {
    renderToggle();
    const group = screen.getByRole("group", { name: "Detection mode" });
    const hint = document.getElementById(group.getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent).toBe(
      "Switches the active detection plugin. More options are in Settings.",
    );
  });

  it("announces nothing until the mode changes", () => {
    const { container } = renderToggle();
    expect(liveRegion(container)?.textContent ?? "").toBe("");
  });

  it("announces the new mode after a change and switches through the shell handler", () => {
    const { container } = renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "Mouse / touch" }));
    expect(onSelect).toHaveBeenCalledWith("detection/pointer");
    expect(useAppConfigStore.getState().activePlugins.detection).toBe("detection/pointer");
    expect(liveRegion(container)?.textContent).toBe("Detection mode: Mouse / touch");
  });

  it("renders nothing when fewer than two modes can be switched", () => {
    const { container } = render(
      <ModeToggle
        slot="detection"
        label="Detection mode"
        options={options.slice(0, 1)}
        onSelect={onSelect}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("does not switch again when the active mode is picked", () => {
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "Hand tracking" }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  describe("with more than two options", () => {
    const manyOptions = [
      ...options,
      { pluginId: "detection/other", label: "Other mode", icon: Hand },
    ];

    const renderPicker = () =>
      render(
        <ModeToggle
          slot="detection"
          label="Detection mode"
          options={manyOptions}
          onSelect={onSelect}
        />,
      );

    it("collapses to a single button naming the active mode", () => {
      renderPicker();
      expect(screen.getAllByRole("button")).toHaveLength(1);
      const trigger = screen.getByRole("button", { name: "Detection mode: Hand tracking" });
      expect(document.getElementById(trigger.getAttribute("aria-describedby") ?? "")).toBeTruthy();
    });

    it("opens a labelled list and closes it after picking", () => {
      const { container } = renderPicker();
      fireEvent.click(screen.getByRole("button", { name: "Detection mode: Hand tracking" }));
      fireEvent.click(screen.getByRole("button", { name: "Mouse / touch" }));
      expect(useAppConfigStore.getState().activePlugins.detection).toBe("detection/pointer");
      expect(liveRegion(container)?.textContent).toBe("Detection mode: Mouse / touch");
      expect(screen.queryByRole("group", { name: "Detection mode" })).toBeNull();
      expect(screen.getByRole("button", { name: "Detection mode: Mouse / touch" })).toBeTruthy();
    });
  });
});
