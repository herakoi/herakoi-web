/* eslint-disable jsx-a11y/media-has-caption */
/**
 * @vitest-environment happy-dom
 */

import { act, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useVideoAspectRatio } from "./useVideoAspectRatio";

type HookHarnessProps = {
  onAspectRatioChange: (aspectRatio: number) => void;
  onVideoMount: (video: HTMLVideoElement) => void;
  primeVideoState?: (video: HTMLVideoElement) => void;
};

const HookHarness = ({ onAspectRatioChange, onVideoMount, primeVideoState }: HookHarnessProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const aspectRatio = useVideoAspectRatio(videoRef);

  useLayoutEffect(() => {
    if (!videoRef.current) return;
    primeVideoState?.(videoRef.current);
    onVideoMount(videoRef.current);
  }, [onVideoMount, primeVideoState]);

  useLayoutEffect(() => {
    onAspectRatioChange(aspectRatio);
  }, [aspectRatio, onAspectRatioChange]);

  // biome-ignore lint/a11y/useMediaCaption: test harness video
  return <video ref={videoRef} />;
};

describe("useVideoAspectRatio", () => {
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

  it("starts with fallback aspect ratio", () => {
    const ratioSpy = vi.fn();

    mountHarness({
      onAspectRatioChange: ratioSpy,
      onVideoMount: () => {},
    });

    expect(ratioSpy).toHaveBeenLastCalledWith(16 / 9);
  });

  it("updates aspect ratio from video dimensions", () => {
    const ratioSpy = vi.fn();
    let mountedVideo: HTMLVideoElement | null = null;

    mountHarness({
      onAspectRatioChange: ratioSpy,
      onVideoMount: (video) => {
        mountedVideo = video;
      },
      primeVideoState: (video) => {
        Object.defineProperty(video, "videoWidth", {
          configurable: true,
          value: 1080,
        });
        Object.defineProperty(video, "videoHeight", {
          configurable: true,
          value: 1920,
        });
      },
    });

    expect(mountedVideo).toBeTruthy();
    act(() => {
      mountedVideo?.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(ratioSpy).toHaveBeenLastCalledWith(1080 / 1920);
  });
});
