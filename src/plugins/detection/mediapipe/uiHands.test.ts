/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaPipePointDetector } from "#src/plugins/detection/mediapipe/MediaPipePointDetector";
import { drawFingerFocus, drawHands } from "#src/plugins/detection/mediapipe/overlay";
import { bindHandsUi } from "#src/plugins/detection/mediapipe/uiHands";

vi.mock("#src/plugins/detection/mediapipe/overlay", () => ({
  drawHands: vi.fn(),
  drawFingerFocus: vi.fn(),
}));

// Ensure the test uses happy-dom (declared via file banner)

const makeCanvas = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 10;
  canvas.height = 10;
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  // happy-dom returns null for getContext; stub with a narrow signature and cast back.
  const getContextMock = vi.fn(() => ctx) as unknown as HTMLCanvasElement["getContext"];
  canvas.getContext = getContextMock;

  return { canvas, ctx };
};

describe("bindHandsUi", () => {
  let detector: MediaPipePointDetector;
  beforeEach(() => {
    vi.clearAllMocks();
    const onHandsDrawnCallbacks: Array<(lms: unknown[]) => void> = [];
    const onPointsDetectedCallbacks: Array<
      (pts: Array<{ id: string; x: number; y: number }>) => void
    > = [];

    detector = {
      onHandsDrawn: (cb: (lms: unknown[]) => void) => {
        onHandsDrawnCallbacks.push(cb);
      },
      onPointsDetected: (cb: (pts: Array<{ id: string; x: number; y: number }>) => void) => {
        onPointsDetectedCallbacks.push(cb);
      },
    } as unknown as MediaPipePointDetector;

    (detector as unknown as { __emitHands: (lms: unknown[]) => void }).__emitHands = (lms) => {
      for (const cb of onHandsDrawnCallbacks) {
        cb(lms);
      }
    };
    (
      detector as unknown as {
        __emitPoints: (pts: Array<{ id: string; x: number; y: number }>) => void;
      }
    ).__emitPoints = (pts) => {
      for (const cb of onPointsDetectedCallbacks) {
        cb(pts);
      }
    };
  });

  it("draws on every overlay and clears each frame", () => {
    const a = makeCanvas();
    const b = makeCanvas();

    bindHandsUi(detector, [a.canvas, b.canvas]);

    (
      detector as unknown as {
        __emitHands: (lms: Array<Array<{ x: number; y: number; z: number }>>) => void;
      }
    ).__emitHands([[{ x: 0, y: 0, z: 0 }]]);
    expect(a.ctx.clearRect).toHaveBeenCalled();
    expect(b.ctx.clearRect).toHaveBeenCalled();
    expect(drawHands).toHaveBeenCalled();

    (
      detector as unknown as {
        __emitPoints: (pts: Array<{ id: string; x: number; y: number }>) => void;
      }
    ).__emitPoints([{ id: "p1", x: 0.5, y: 0.5 }]);
    expect(drawFingerFocus).toHaveBeenCalledTimes(2);
  });

  it("projects points with cover fit to avoid landmark stretching", () => {
    const { canvas } = makeCanvas();
    canvas.width = 160;
    canvas.height = 90;

    bindHandsUi(detector, [
      {
        canvas,
        fitMode: "cover",
        sourceSize: { width: 640, height: 480 },
      },
    ]);

    (
      detector as unknown as {
        __emitPoints: (pts: Array<{ id: string; x: number; y: number }>) => void;
      }
    ).__emitPoints([{ id: "p1", x: 0.5, y: 0 }]);

    const firstCall = (drawFingerFocus as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0];
    if (!firstCall) {
      throw new Error("Expected drawFingerFocus to be called");
    }

    const focus = firstCall[1] as { x: number; y: number };
    expect(focus.x).toBe(80);
    expect(focus.y).toBe(-15);
  });
});
