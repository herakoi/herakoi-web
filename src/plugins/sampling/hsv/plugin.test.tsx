/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHSVSamplingConfig, type HSVSamplingConfig } from "./config";
import { plugin } from "./plugin";

const expectSamplerHandle = (result: ReturnType<typeof plugin.createSampler>) => {
  if (result instanceof Error) throw result;
  return result;
};

const mocks = vi.hoisted(() => ({
  samplerLoadImage: vi.fn().mockResolvedValue(undefined),
  drawImageToCanvas: vi.fn(
    (
      _canvas: HTMLCanvasElement,
      _image: HTMLImageElement,
      _viewportMode: HSVSamplingConfig["viewportMode"],
    ) => true,
  ),
  resizeCanvasToContainer: vi.fn(),
  getDefaultImageId: vi.fn<() => string | null>(() => "curated-default"),
  resolveImageSourceById: vi.fn<(id: string | null | undefined) => string | null>((id) => {
    if (id === "curated-default") return "https://example.com/default.png";
    return null;
  }),
  setImageReady: vi.fn(),
  setCoverModeActive: vi.fn(),
  notifyCoverModeActivated: vi.fn(),
}));

class InstantImage {
  public crossOrigin = "";
  public onload: ((event: Event) => void) | null = null;
  public onerror: ((event: Event | string) => void) | null = null;
  protected imageSrc = "";

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
      setCoverModeActive: mocks.setCoverModeActive,
      notifyCoverModeActivated: mocks.notifyCoverModeActivated,
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

    const handle = expectSamplerHandle(plugin.createSampler(currentConfig, runtime));
    handle.setCanvasRefs?.({ imageCanvas: { current: imageCanvas } });

    await handle.postInitialize?.();

    expect(mocks.resolveImageSourceById).toHaveBeenCalledWith("upload-missing");
    expect(mocks.resolveImageSourceById).toHaveBeenCalledWith("curated-default");
    expect(mocks.samplerLoadImage).toHaveBeenCalledTimes(1);
    expect(runtime.setConfig).toHaveBeenCalledWith({ currentImageId: "curated-default" });
  });

  it("keeps the latest selected image when async loads resolve out of order", async () => {
    const imageCanvas = document.createElement("canvas");
    const pendingLoads = new Map<string, DeferredImage[]>();

    class DeferredImage extends InstantImage {
      override set src(value: string) {
        this.imageSrc = value;
        const queue = pendingLoads.get(value) ?? [];
        queue.push(this);
        pendingLoads.set(value, queue);
      }

      triggerLoad() {
        this.onload?.(new Event("load"));
      }
    }

    vi.stubGlobal("Image", DeferredImage);

    mocks.resolveImageSourceById.mockImplementation((id: string | null | undefined) => {
      if (id === "curated-default") return "https://example.com/default.png";
      if (id === "curated-a") return "https://example.com/a.png";
      if (id === "curated-b") return "https://example.com/b.png";
      return null;
    });

    let currentConfig: HSVSamplingConfig = {
      ...defaultHSVSamplingConfig,
      currentImageId: "curated-default",
    };
    const configListeners: Array<(config: HSVSamplingConfig) => void> = [];
    const runtime = {
      getConfig: () => currentConfig,
      setConfig: (updates: Partial<HSVSamplingConfig>) => {
        currentConfig = { ...currentConfig, ...updates };
      },
      subscribeConfig: (handler: (config: HSVSamplingConfig) => void) => {
        configListeners.push(handler);
        return () => {
          // noop
        };
      },
    };

    const handle = expectSamplerHandle(plugin.createSampler(currentConfig, runtime));
    handle.setCanvasRefs?.({ imageCanvas: { current: imageCanvas } });
    const initializePromise = handle.postInitialize?.();

    const resolveOne = (src: string): DeferredImage => {
      const queue = pendingLoads.get(src);
      const image = queue?.shift();
      if (!image) throw new Error(`No pending image for ${src}`);
      image.triggerLoad();
      return image;
    };

    resolveOne("https://example.com/default.png");
    await initializePromise;

    if (configListeners.length === 0) {
      throw new Error("Config subscription callbacks were not registered");
    }
    mocks.drawImageToCanvas.mockClear();
    mocks.samplerLoadImage.mockClear();

    currentConfig = { ...currentConfig, currentImageId: "curated-a" };
    for (const listener of configListeners) {
      listener(currentConfig);
    }
    currentConfig = { ...currentConfig, currentImageId: "curated-b" };
    for (const listener of configListeners) {
      listener(currentConfig);
    }

    expect(mocks.resolveImageSourceById).toHaveBeenCalledWith("curated-a");
    expect(mocks.resolveImageSourceById).toHaveBeenCalledWith("curated-b");
    expect(pendingLoads.get("https://example.com/a.png")?.length).toBe(1);
    expect(pendingLoads.get("https://example.com/b.png")?.length).toBe(1);

    const resolvedB = resolveOne("https://example.com/b.png");
    await Promise.resolve();
    const resolvedA = resolveOne("https://example.com/a.png");
    await Promise.resolve();

    const drawCalls = mocks.drawImageToCanvas.mock.calls;
    expect(drawCalls).toHaveLength(1);
    const firstDrawnImage = drawCalls[0]?.[1];
    expect(firstDrawnImage).toBe(resolvedB);
    expect(firstDrawnImage).not.toBe(resolvedA);
  });
});
