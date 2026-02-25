/**
 * @vitest-environment happy-dom
 */

import { act, useCallback, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorOr } from "#src/core/interfaces";
import { useHSVRuntimeStore } from "../runtimeStore";
import type { ImageEntry } from "../types/image";
import { useImageLibrary } from "./useImageLibrary";

vi.mock("../lib/imageUtils", async () => ({
  formatBytes: () => "3 B",
  formatImageType: () => "PNG",
  loadImageDimensions: vi.fn(async () => ({ width: 100, height: 50 })),
  readFileAsDataUrl: vi.fn(async () => "data:image/png;base64,AAAA"),
}));

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
  selectedImageId: string | null;
  onSelectImage: (entry: ImageEntry) => Promise<void>;
  onExposeApi?: (api: { handleImageFile: (file: File) => Promise<ErrorOr<undefined>> }) => void;
  onSnapshot?: (snapshot: { currentImageId: string; uploadIds: string[] }) => void;
};

const HookHarness = ({
  selectedImageId,
  onSelectImage,
  onExposeApi,
  onSnapshot,
}: HookHarnessProps) => {
  const { currentImage, uploads, handleImageFile } = useImageLibrary({
    curatedImages,
    howItWorksImages: [],
    selectedImageId,
    onSelectImage,
  });

  useLayoutEffect(() => {
    onExposeApi?.({ handleImageFile });
  }, [handleImageFile, onExposeApi]);

  useLayoutEffect(() => {
    onSnapshot?.({
      currentImageId: currentImage.id,
      uploadIds: uploads.map((entry) => entry.id),
    });
  }, [currentImage.id, onSnapshot, uploads]);

  useLayoutEffect(() => {
    // no-op: force a stable layout-effect boundary for mount timing in tests
  }, []);

  return null;
};

describe("useImageLibrary", () => {
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
    useHSVRuntimeStore.setState({
      imageReady: false,
      uploads: [],
      uploadsHydrated: false,
      imageLibraryStatus: { status: "ok" },
    });
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

  it("shares uploads and derived current image across multiple hook instances", async () => {
    type HookApi = { handleImageFile: (file: File) => Promise<ErrorOr<undefined>> };
    const apis: Record<"left" | "right", HookApi | null> = { left: null, right: null };
    const snapshots: Record<"left" | "right", { currentImageId: string; uploadIds: string[] }> = {
      left: { currentImageId: "app-config-image", uploadIds: [] },
      right: { currentImageId: "app-config-image", uploadIds: [] },
    };

    const DualHarness = () => {
      const [selectedImageId, setSelectedImageId] = useState<string | null>("app-config-image");
      const onSelectImage = useCallback(async (entry: ImageEntry) => {
        setSelectedImageId(entry.id);
      }, []);

      return (
        <>
          <HookHarness
            selectedImageId={selectedImageId}
            onSelectImage={onSelectImage}
            onExposeApi={(api) => {
              apis.left = api;
            }}
            onSnapshot={(snapshot) => {
              snapshots.left = snapshot;
            }}
          />
          <HookHarness
            selectedImageId={selectedImageId}
            onSelectImage={onSelectImage}
            onExposeApi={(api) => {
              apis.right = api;
            }}
            onSnapshot={(snapshot) => {
              snapshots.right = snapshot;
            }}
          />
        </>
      );
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<DualHarness />);
      await Promise.resolve();
    });

    const file = new File(["abc"], "shared.png", { type: "image/png", lastModified: 123 });
    const expectedId = "upload-shared.png-3-123";
    expect(apis.left).not.toBeNull();

    await act(async () => {
      await apis.left?.handleImageFile(file);
      await Promise.resolve();
    });

    expect(snapshots.left.currentImageId).toBe(expectedId);
    expect(snapshots.right.currentImageId).toBe(expectedId);
    expect(snapshots.left.uploadIds).toContain(expectedId);
    expect(snapshots.right.uploadIds).toContain(expectedId);
  });
});
