/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHSVSamplingConfig, type HSVSamplingConfig } from "./config";
import { plugin } from "./plugin";

const mocks = vi.hoisted(() => ({
  samplerLoadImage: vi.fn().mockResolvedValue(undefined),
  drawImageToCanvas: vi.fn(() => true),
  resizeCanvasToContainer: vi.fn(),
  getDefaultImageId: vi.fn(() => "curated-default"),
  resolveImageSourceById: vi.fn((id: string) => {
    if (id === "curated-default") return "https://example.com/default.png";
    return null;
  }),
  setImageReady: vi.fn(),
}));

class InstantImage {
  public crossOrigin = "";
  public onload: ((event: Event) => void) | null = null;
  public onerror: ((event: Event | string) => void) | null = null;
  private imageSrc = "";

  set src(value: string) {
    this.imageSrc = value;
    queueMicrotask(() => {
      this.onload?.(new Event("load"));
    });
  }

  get src() {
    return this.imageSrc;
  }
}

vi.mock("./HSVImageSampler", () => ({
  HSVImageSampler: vi.fn().mockImplementation(
    class {
      public loadImage = mocks.samplerLoadImage;
      // biome-ignore lint/suspicious/noExplicitAny: Vitest constructor mock requires widened signature
    } as unknown as (...args: any[]) => any,
  ),
}));

vi.mock("./imageDrawing", () => ({
  drawImageToCanvas: mocks.drawImageToCanvas,
  resizeCanvasToContainer: mocks.resizeCanvasToContainer,
}));

vi.mock("./lib/imageSourceResolver", () => ({
  getDefaultImageId: mocks.getDefaultImageId,
  resolveImageSourceById: mocks.resolveImageSourceById,
}));

vi.mock("./runtimeStore", () => ({
  useHSVRuntimeStore: {
    getState: () => ({
      setImageReady: mocks.setImageReady,
    }),
  },
}));

describe("HSV sampling plugin initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("Image", InstantImage);
  });

  it("falls back to the bundled default image when persisted image id cannot be resolved", async () => {
    const imageCanvas = document.createElement("canvas");
    let currentConfig: HSVSamplingConfig = {
      ...defaultHSVSamplingConfig,
      currentImageId: "upload-missing",
    };

    const runtime = {
      getConfig: vi.fn(() => currentConfig),
      setConfig: vi.fn((updates: Partial<HSVSamplingConfig>) => {
        currentConfig = { ...currentConfig, ...updates };
      }),
      subscribeConfig: vi.fn(() => () => {
        // noop
      }),
    };

    const handle = plugin.createSampler(currentConfig, runtime);
    handle.setCanvasRefs?.({ imageCanvas: { current: imageCanvas } });

    await handle.postInitialize?.();

    expect(mocks.resolveImageSourceById).toHaveBeenCalledWith("upload-missing");
    expect(mocks.resolveImageSourceById).toHaveBeenCalledWith("curated-default");
    expect(mocks.samplerLoadImage).toHaveBeenCalledTimes(1);
    expect(runtime.setConfig).toHaveBeenCalledWith({ currentImageId: "curated-default" });
  });
});
