/**
 * @vitest-environment happy-dom
 */

import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageEntry } from "../types/image";
import { useImageLibrary } from "./useImageLibrary";

const IMAGE_SELECTION_KEY = "herakoi.image-selection.v1";

const curatedImages = [
  {
    id: "app-config-image",
    title: "App config image",
    meta: "meta",
    src: "https://example.com/app-config-image.png",
    previewSrc: "https://example.com/app-config-image.png",
    kind: "curated" as const,
  },
  {
    id: "legacy-image",
    title: "Legacy image",
    meta: "meta",
    src: "https://example.com/legacy-image.png",
    previewSrc: "https://example.com/legacy-image.png",
    kind: "curated" as const,
  },
];

type HookHarnessProps = {
  onSelectImage: (entry: ImageEntry) => Promise<void>;
};

const HookHarness = ({ onSelectImage }: HookHarnessProps) => {
  useImageLibrary({
    curatedImages,
    howItWorksImages: [],
    onSelectImage,
  });

  useLayoutEffect(() => {
    // no-op: force a stable layout-effect boundary for mount timing in tests
  }, []);

  return null;
};

describe("useImageLibrary legacy image selection restore", () => {
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
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
  });

  afterAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT =
      previousActFlag;
  });

  const mountHarness = async (props: HookHarnessProps) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<HookHarness {...props} />);
      await Promise.resolve();
    });
  };

  it("does not replay legacy localStorage image id into plugin config on mount", async () => {
    localStorage.setItem(IMAGE_SELECTION_KEY, JSON.stringify({ id: "legacy-image" }));
    const onSelectImage = vi.fn().mockResolvedValue(undefined);

    await mountHarness({
      onSelectImage,
    });

    expect(onSelectImage).not.toHaveBeenCalled();
  });
});
