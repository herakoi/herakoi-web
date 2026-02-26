/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PointerOverlayNotMountedError } from "./errors";
import { PointerPointDetector } from "./PointerPointDetector";

const createPointerEvent = (
  type: string,
  init: Partial<PointerEventInit> &
    Pick<PointerEventInit, "clientX" | "clientY"> & {
      pointerType: string;
      pointerId?: number;
      isPrimary?: boolean;
    },
): PointerEvent => {
  if (typeof PointerEvent === "function") {
    return new PointerEvent(type, {
      bubbles: true,
      ...init,
    });
  }

  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(event, init);
  return event;
};

describe("PointerPointDetector", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      top: 0,
      right: 200,
      bottom: 100,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });

  it("returns tagged error when overlay canvas is missing", async () => {
    const detector = new PointerPointDetector(() => null);

    await detector.initialize();
    const startResult = detector.start();

    expect(startResult).toBeInstanceOf(PointerOverlayNotMountedError);
  });

  it("emits normalized mouse pointer coordinates", async () => {
    const detector = new PointerPointDetector(() => canvas);
    const onDetected = vi.fn();
    detector.onPointsDetected(onDetected);

    await detector.initialize();
    detector.start();

    window.dispatchEvent(
      createPointerEvent("pointermove", {
        clientX: 100,
        clientY: 50,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );

    expect(onDetected).toHaveBeenLastCalledWith([{ id: "pointer-mouse", x: 0.5, y: 0.5 }]);
  });

  it("emits empty points when active touch pointer ends", async () => {
    const detector = new PointerPointDetector(() => canvas);
    const onDetected = vi.fn();
    detector.onPointsDetected(onDetected);

    await detector.initialize();
    detector.start();

    window.dispatchEvent(
      createPointerEvent("pointerdown", {
        clientX: 100,
        clientY: 50,
        pointerType: "touch",
        pointerId: 7,
      }),
    );
    window.dispatchEvent(
      createPointerEvent("pointerup", {
        clientX: 100,
        clientY: 50,
        pointerType: "touch",
        pointerId: 7,
      }),
    );

    expect(onDetected).toHaveBeenLastCalledWith([]);
  });

  it("tracks multiple touches at the same time", async () => {
    const detector = new PointerPointDetector(() => canvas);
    const onDetected = vi.fn();
    detector.onPointsDetected(onDetected);

    await detector.initialize();
    detector.start();

    window.dispatchEvent(
      createPointerEvent("pointerdown", {
        clientX: 40,
        clientY: 20,
        pointerType: "touch",
        pointerId: 1,
      }),
    );
    window.dispatchEvent(
      createPointerEvent("pointerdown", {
        clientX: 160,
        clientY: 80,
        pointerType: "touch",
        pointerId: 2,
      }),
    );

    expect(onDetected).toHaveBeenLastCalledWith([
      { id: "pointer-touch-1", x: 0.2, y: 0.2 },
      { id: "pointer-touch-2", x: 0.8, y: 0.8 },
    ]);

    window.dispatchEvent(
      createPointerEvent("pointerup", {
        clientX: 40,
        clientY: 20,
        pointerType: "touch",
        pointerId: 1,
      }),
    );

    expect(onDetected).toHaveBeenLastCalledWith([{ id: "pointer-touch-2", x: 0.8, y: 0.8 }]);
  });

  it("clears active points when window loses focus", async () => {
    const detector = new PointerPointDetector(() => canvas);
    const onDetected = vi.fn();
    detector.onPointsDetected(onDetected);

    await detector.initialize();
    detector.start();

    window.dispatchEvent(
      createPointerEvent("pointermove", {
        clientX: 100,
        clientY: 50,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
    window.dispatchEvent(new Event("blur"));

    expect(onDetected).toHaveBeenLastCalledWith([]);
  });
});
