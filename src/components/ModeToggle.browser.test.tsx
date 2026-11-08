import { cleanup, render } from "@testing-library/react";
import { Hand, MousePointer2 } from "lucide-react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { ModeToggle } from "./ModeToggle";

afterEach(cleanup);

const options = [
  { pluginId: "detection/mediapipe", label: "Hand tracking", icon: Hand },
  { pluginId: "detection/pointer", label: "Mouse / touch", icon: MousePointer2 },
];

describe("ModeToggle — inside the shell's click-through rails", () => {
  test("stays clickable inside a pointer-events-none container", async () => {
    const onSelect = vi.fn();
    render(
      <div style={{ pointerEvents: "none" }}>
        <ModeToggle slot="detection" label="Detection mode" options={options} onSelect={onSelect} />
      </div>,
    );
    const group = page.getByRole("group", { name: "Detection mode" });
    await expect.element(group).toBeInTheDocument();
    expect(getComputedStyle(group.element()).pointerEvents).toBe("auto");
    await page.getByRole("button", { name: "Mouse / touch" }).click();
    expect(onSelect).toHaveBeenCalledWith("detection/pointer");
  });
});
