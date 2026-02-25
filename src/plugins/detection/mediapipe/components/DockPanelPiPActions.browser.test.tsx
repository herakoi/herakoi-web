import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { Floating } from "#src/shared/components/Floating";
import { DockPanelPiPActions } from "./DockPanelPiPActions";
import { DockPanelPiPSurface } from "./DockPanelPiPSurface";

afterEach(cleanup);

const baseProps = {
  mirror: false as boolean,
  maxHands: 1,
  isResizing: false,
  onHide: () => {},
  onToggleMirror: () => {},
  onCycleMaxHands: () => {},
  onResizePointerDown: () => {},
  onResizeKeyDown: () => {},
};

const baseSurfaceProps = {
  videoRef: { current: null },
  overlayRef: { current: null },
  isRunning: false,
  mirror: false,
  videoReady: true,
};

function renderActions(props: Partial<typeof baseProps>) {
  render(
    <DockPanelPiPSurface {...baseSurfaceProps} mirror={props.mirror ?? baseProps.mirror}>
      <DockPanelPiPActions {...baseProps} {...props} />
    </DockPanelPiPSurface>,
  );
}

describe("DockPanelPiPActions — mirror button visual state", () => {
  test("mirror=false: button is semantically inactive (aria-pressed=false, aria-label='Enable mirror')", async () => {
    renderActions({ mirror: false });
    const btn = page.getByRole("button", { name: "Enable mirror" });
    await expect.element(btn).toHaveAttribute("aria-pressed", "false");
  });

  test("mirror=true: button is semantically active (aria-pressed=true, aria-label='Disable mirror')", async () => {
    renderActions({ mirror: true });
    const btn = page.getByRole("button", { name: "Disable mirror" });
    await expect.element(btn).toHaveAttribute("aria-pressed", "true");
  });

  test("mirror=false: button background is dark (semi-transparent black)", async () => {
    renderActions({ mirror: false });
    const btn = page.getByRole("button", { name: "Enable mirror" });
    await expect.element(btn).toBeInTheDocument();
    const bg = getComputedStyle(btn.element()).backgroundColor;
    // bg-black/55 → rgba(0, 0, 0, ~0.55)
    expect(bg).toMatch(/^rgba\(0,\s*0,\s*0,/);
  });

  test("mirror=true: button background is light (semi-transparent white)", async () => {
    renderActions({ mirror: true });
    const btn = page.getByRole("button", { name: "Disable mirror" });
    await expect.element(btn).toBeInTheDocument();
    const bg = getComputedStyle(btn.element()).backgroundColor;
    // bg-white/85 → rgba(255, 255, 255, ~0.85)
    expect(bg).toMatch(/^rgba\(255,\s*255,\s*255,/);
  });
});

describe("DockPanelPiPActions — button callbacks", () => {
  test("clicking hide calls onHide", async () => {
    let called = false;
    renderActions({
      mirror: false,
      onHide: () => {
        called = true;
      },
    });
    await page.getByRole("button", { name: "Hide picture-in-picture" }).click();
    expect(called).toBe(true);
  });

  test("clicking mirror calls onToggleMirror", async () => {
    let called = false;
    renderActions({
      mirror: false,
      onToggleMirror: () => {
        called = true;
      },
    });
    await page.getByRole("button", { name: "Enable mirror" }).click();
    expect(called).toBe(true);
  });

  test("clicking max hands calls onCycleMaxHands", async () => {
    let called = false;
    renderActions({
      mirror: false,
      onCycleMaxHands: () => {
        called = true;
      },
    });
    await page.getByRole("button", { name: "Cycle max hands" }).click();
    expect(called).toBe(true);
  });

  test("maxHands count is shown in the sr-only badge", async () => {
    renderActions({ mirror: false, maxHands: 3 });
    await expect.element(page.getByText("Max hands: 3")).toBeInTheDocument();
  });
});

describe("DockPanelPiPActions — clickable inside Floating with move-handle overlay", () => {
  // Replicates the current DockPanel structure where Floating renders a standalone
  // move-handle button above children. With an isolated child stacking context,
  // action buttons can become unreachable due to pointer interception.
  function renderInsideFloating(props: Partial<typeof baseProps>) {
    render(
      <Floating open initial={{ x: 0, y: 0, width: 320 }}>
        {({ onResizePointerDown, onResizeKeyDown, isResizing }) => (
          // isolation:isolate replicates the stacking context created by backdrop-blur in DockPanel.
          // Without it inner z-20 buttons can escape and hide the bug.
          <div style={{ position: "relative", isolation: "isolate", height: 200 }}>
            <DockPanelPiPSurface {...baseSurfaceProps} mirror={props.mirror ?? baseProps.mirror}>
              <DockPanelPiPActions
                {...baseProps}
                {...props}
                isResizing={isResizing}
                onResizePointerDown={onResizePointerDown}
                onResizeKeyDown={onResizeKeyDown}
              />
            </DockPanelPiPSurface>
          </div>
        )}
      </Floating>,
    );
  }

  test("hide button is clickable through the move-handle overlay", async () => {
    let called = false;
    renderInsideFloating({
      mirror: false,
      onHide: () => {
        called = true;
      },
    });
    await page.getByRole("button", { name: "Hide picture-in-picture" }).click({ timeout: 300 });
    expect(called).toBe(true);
  });

  test("mirror button is clickable through the move-handle overlay", async () => {
    let called = false;
    renderInsideFloating({
      mirror: false,
      onToggleMirror: () => {
        called = true;
      },
    });
    await page.getByRole("button", { name: "Enable mirror" }).click({ timeout: 300 });
    expect(called).toBe(true);
  });

  test("max hands button is clickable through the move-handle overlay", async () => {
    let called = false;
    renderInsideFloating({
      mirror: false,
      onCycleMaxHands: () => {
        called = true;
      },
    });
    await page.getByRole("button", { name: "Cycle max hands" }).click({ timeout: 300 });
    expect(called).toBe(true);
  });
});
