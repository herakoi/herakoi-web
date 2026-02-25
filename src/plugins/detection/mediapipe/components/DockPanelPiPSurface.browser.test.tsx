import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { Floating } from "#src/shared/components/Floating";
import { DockPanelPiPActions } from "./DockPanelPiPActions";
import { DockPanelPiPSurface } from "./DockPanelPiPSurface";

afterEach(cleanup);

const baseProps = {
  videoRef: { current: null },
  overlayRef: { current: null },
  isRunning: false,
  mirror: false,
  videoReady: true,
};

const baseActionsProps = {
  maxHands: 1,
  isResizing: false,
  onHide: () => {},
  onToggleMirror: () => {},
  onCycleMaxHands: () => {},
  onResizePointerDown: () => {},
  onResizeKeyDown: () => {},
};

describe("DockPanelPiPSurface", () => {
  test("mirror action is clickable when rendered standalone", async () => {
    let called = false;
    render(
      <DockPanelPiPSurface {...baseProps} mirror={false}>
        <DockPanelPiPActions
          {...baseActionsProps}
          mirror={false}
          onToggleMirror={() => {
            called = true;
          }}
        />
      </DockPanelPiPSurface>,
    );
    await page.getByRole("button", { name: "Enable mirror" }).click();
    expect(called).toBe(true);
  });

  test("actions are blocked when rendered inside Floating standalone move overlay", async () => {
    render(
      <Floating open initial={{ x: 0, y: 0, width: 320 }}>
        {({ isResizing, onResizePointerDown, onResizeKeyDown }) => (
          <div style={{ position: "relative", isolation: "isolate", height: 200 }}>
            <DockPanelPiPSurface {...baseProps}>
              <DockPanelPiPActions
                {...baseActionsProps}
                mirror={false}
                isResizing={isResizing}
                onResizePointerDown={onResizePointerDown}
                onResizeKeyDown={onResizeKeyDown}
              />
            </DockPanelPiPSurface>
          </div>
        )}
      </Floating>,
    );
    await expect(
      page.getByRole("button", { name: "Hide picture-in-picture" }).click({ timeout: 300 }),
    ).rejects.toThrow();
  });
});
