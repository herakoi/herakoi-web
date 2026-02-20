/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHSVSamplingConfig } from "../config";
import { curatedImages } from "../data/curatedImages";
import { HSVToolbarItems } from "./ToolbarItems";

describe("HSVToolbarItems image selection sync", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let previousActFlag: unknown;

  beforeAll(() => {
    previousActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown })
      .IS_REACT_ACT_ENVIRONMENT;
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  afterAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT =
      previousActFlag;
  });

  it("uses config.currentImageId as the selected toolbar label on mount", async () => {
    const fallbackEntry = curatedImages[0];
    const configuredEntry = curatedImages[1];
    expect(fallbackEntry).toBeDefined();
    expect(configuredEntry).toBeDefined();

    const setConfig = vi.fn();
    await act(async () => {
      root.render(
        <HSVToolbarItems
          config={{
            ...defaultHSVSamplingConfig,
            currentImageId: configuredEntry.id,
          }}
          setConfig={setConfig}
        />,
      );
      await Promise.resolve();
    });

    const selectedButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Select image: "]',
    );

    expect(selectedButton).not.toBeNull();
    expect(selectedButton?.getAttribute("aria-label")).toBe(
      `Select image: ${configuredEntry.title}`,
    );
    expect(selectedButton?.getAttribute("aria-label")).not.toBe(
      `Select image: ${fallbackEntry.title}`,
    );
  });
});
