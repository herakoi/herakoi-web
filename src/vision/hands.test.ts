import type { Options } from "@mediapipe/hands";
import { beforeEach, describe, expect, it, vi } from "vitest";

const handsInstanceRef: {
  current: null | { setOptions: ReturnType<typeof vi.fn> };
} = {
  current: null,
};

const handsConstructor = vi.fn(function HandsMock() {
  if (!handsInstanceRef.current) {
    handsInstanceRef.current = {
      setOptions: vi.fn(),
    };
  }
  return handsInstanceRef.current;
});

vi.mock("@mediapipe/hands", () => ({
  Hands: handsConstructor,
}));

beforeEach(() => {
  handsConstructor.mockClear();
  handsInstanceRef.current = {
    setOptions: vi.fn(),
  };
});

/**
 * We are teasing apart the MediaPipe integration that originally lived inline in
 * legacy_html/herakoi_web_test/herakoi.html:96. In that page, the `Hands`
 * constructor receives a `locateFile` callback that always hits the CDN. Our
 * detector wrapper should instead resolve local assets so we stay functional
 * when the device is offline.
 */
describe("HandsDetector asset resolution", () => {
  it("points MediaPipe Hands at locally bundled assets by default", async () => {
    const { HandsDetector } = await import("./hands");

    const detector = new HandsDetector();
    expect(detector).toBeDefined();
    expect(handsInstanceRef.current?.setOptions).not.toHaveBeenCalled();

    // The constructor should eagerly instantiate Hands with a locateFile helper.
    expect(handsConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        locateFile: expect.any(Function),
      }),
    );

    type HandsConstructorOptions = {
      locateFile: (file: string) => string;
    };

    const firstCall = handsConstructor.mock.calls[0] as unknown as
      | [HandsConstructorOptions]
      | undefined;
    if (!firstCall) {
      throw new Error("Expected Hands to be constructed exactly once.");
    }
    const [{ locateFile }] = firstCall;
    const expectedUrlImport = await import("@mediapipe/hands/hands.binarypb?url");
    const expectedUrl = expectedUrlImport.default;
    const assetPath = locateFile("hands.binarypb");
    expect(assetPath).toBe(expectedUrl);
  });
});

describe("HandsDetector configuration passthrough", () => {
  it("applies caller-provided MediaPipe options during construction", async () => {
    const overrides: Partial<Options> = {
      maxNumHands: 1,
      minDetectionConfidence: 0.9,
    };
    const { HandsDetector } = await import("./hands");

    const detector = new HandsDetector(overrides);
    expect(detector).toBeDefined();

    expect(handsInstanceRef.current?.setOptions).toHaveBeenCalledWith(
      expect.objectContaining(overrides),
    );
  });
});
