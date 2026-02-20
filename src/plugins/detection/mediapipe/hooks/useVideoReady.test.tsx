/* eslint-disable jsx-a11y/media-has-caption */
/**
 * @vitest-environment happy-dom
 */

import { act, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useVideoReady } from "./useVideoReady";

type HookHarnessProps = {
  onReadyChange: (ready: boolean) => void;
  onVideoMount: (video: HTMLVideoElement) => void;
  primeVideoState?: (video: HTMLVideoElement) => void;
};

const HookHarness = ({ onReadyChange, onVideoMount, primeVideoState }: HookHarnessProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoReady = useVideoReady(videoRef);

  useLayoutEffect(() => {
    if (!videoRef.current) return;
    primeVideoState?.(videoRef.current);
    onVideoMount(videoRef.current);
  }, [onVideoMount, primeVideoState]);

  useLayoutEffect(() => {
    onReadyChange(videoReady);
  }, [onReadyChange, videoReady]);

  // biome-ignore lint/a11y/useMediaCaption: it's just a tets
  return <video ref={videoRef} />;
};

describe("useVideoReady", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let previousActFlag: unknown;

  beforeAll(() => {
    previousActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown })
      .IS_REACT_ACT_ENVIRONMENT;
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
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

  const mountHarness = (props: HookHarnessProps) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<HookHarness {...props} />);
    });
  };

  it("starts ready when stream is present and video has enough data", () => {
    const readySpy = vi.fn();
    let mountedVideo: HTMLVideoElement | null = null;

    mountHarness({
      onReadyChange: readySpy,
      onVideoMount: (video) => {
        mountedVideo = video;
      },
      primeVideoState: (video) => {
        Object.defineProperty(video, "srcObject", {
          configurable: true,
          value: {},
          writable: true,
        });
        Object.defineProperty(video, "readyState", {
          configurable: true,
          value: 2,
        });
        Object.defineProperty(video, "paused", {
          configurable: true,
          value: false,
        });
      },
    });

    expect(mountedVideo).toBeTruthy();
    expect(readySpy).toHaveBeenLastCalledWith(true);
  });

  it("toggles ready on media lifecycle events", () => {
    const readySpy = vi.fn();
    let mountedVideo: HTMLVideoElement | null = null;

    mountHarness({
      onReadyChange: readySpy,
      onVideoMount: (video) => {
        mountedVideo = video;
      },
      primeVideoState: (video) => {
        Object.defineProperty(video, "srcObject", {
          configurable: true,
          value: {},
          writable: true,
        });
        Object.defineProperty(video, "readyState", {
          configurable: true,
          value: 0,
        });
        Object.defineProperty(video, "paused", {
          configurable: true,
          value: true,
        });
      },
    });

    expect(mountedVideo).toBeTruthy();
    expect(readySpy).toHaveBeenLastCalledWith(false);

    act(() => {
      mountedVideo?.dispatchEvent(new Event("loadeddata"));
    });
    expect(readySpy).toHaveBeenLastCalledWith(true);

    act(() => {
      mountedVideo?.dispatchEvent(new Event("pause"));
    });
    expect(readySpy).toHaveBeenLastCalledWith(false);

    act(() => {
      mountedVideo?.dispatchEvent(new Event("playing"));
    });
    expect(readySpy).toHaveBeenLastCalledWith(true);

    act(() => {
      mountedVideo?.dispatchEvent(new Event("emptied"));
    });
    expect(readySpy).toHaveBeenLastCalledWith(false);
  });
});
