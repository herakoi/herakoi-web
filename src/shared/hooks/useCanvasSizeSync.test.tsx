/**
 * @vitest-environment happy-dom
 */

import { act, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useCanvasSizeSync } from "#src/shared/hooks/useCanvasSizeSync";

type ResizeObserverLike = {
  observe: (target: Element) => void;
  disconnect: () => void;
};

type ResizeObserverCtor = new (callback: ResizeObserverCallback) => ResizeObserverLike;

const observerRecords: Array<{
  callback: ResizeObserverCallback;
  instance: ResizeObserverLike;
  target: Element | null;
}> = [];

class MockResizeObserver implements ResizeObserverLike {
  private callback: ResizeObserverCallback;
  private recordIndex: number;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    this.recordIndex =
      observerRecords.push({
        callback,
        instance: this,
        target: null,
      }) - 1;
  }

  observe(target: Element) {
    observerRecords[this.recordIndex].target = target;
  }

  disconnect() {
    // noop, asserted through spy on prototype in tests
  }

  emit(width: number, height: number) {
    const record = observerRecords[this.recordIndex];
    if (!record.target) return;
    this.callback(
      [
        {
          contentRect: {
            width,
            height,
          } as DOMRectReadOnly,
          target: record.target,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

type HookHarnessProps = {
  onCanvasMount: (canvas: HTMLCanvasElement) => void;
};

const HookHarness = ({ onCanvasMount }: HookHarnessProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasSizeSync(canvasRef);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    onCanvasMount(canvasRef.current);
  }, [onCanvasMount]);

  return <canvas ref={canvasRef} />;
};

describe("useCanvasSizeSync", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let previousObserver: unknown;
  let previousActFlag: unknown;

  beforeAll(() => {
    previousActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown })
      .IS_REACT_ACT_ENVIRONMENT;
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    previousObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as { ResizeObserver: ResizeObserverCtor }).ResizeObserver =
      MockResizeObserver as unknown as ResizeObserverCtor;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    observerRecords.length = 0;
  });

  afterAll(() => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = previousObserver;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT =
      previousActFlag;
  });

  const mountHarness = (props: HookHarnessProps) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<HookHarness {...props} />);
    });
  };

  it("syncs intrinsic canvas size from resize observer events", () => {
    mountHarness({
      onCanvasMount: () => {},
    });

    const maybeCanvas = container.querySelector("canvas");
    if (!(maybeCanvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas was not mounted");
    }
    const canvas = maybeCanvas;
    expect(observerRecords).toHaveLength(1);

    const observer = observerRecords[0].instance as MockResizeObserver;
    act(() => {
      observer.emit(320.4, 181.6);
    });

    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(182);
  });

  it("ignores non-positive sizes", () => {
    mountHarness({
      onCanvasMount: () => {},
    });

    const maybeCanvas = container.querySelector("canvas");
    if (!(maybeCanvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas was not mounted");
    }
    const canvas = maybeCanvas;
    const observer = observerRecords[0].instance as MockResizeObserver;

    act(() => {
      observer.emit(200, 100);
    });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);

    act(() => {
      observer.emit(0, 150);
    });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);

    act(() => {
      observer.emit(200, -1);
    });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
  });

  it("disconnects observer on unmount", () => {
    const disconnectSpy = vi.spyOn(MockResizeObserver.prototype, "disconnect");

    mountHarness({
      onCanvasMount: () => {},
    });

    act(() => {
      root.unmount();
    });

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    disconnectSpy.mockRestore();
  });
});
