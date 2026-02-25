import { describe, expect, it } from "vitest";
import type { SonifierHandle, VisualizerFrameData } from "#src/core/plugin";
import { updateSonificationDebugFrame } from "./visualizerFrame";

describe("updateSonificationDebugFrame", () => {
  it("does nothing when getLastFrameDebug is not available", () => {
    const initialTones = new Map<
      string,
      { frequency: number }
    >() as VisualizerFrameData["sonification"]["tones"];
    const sonifierHandleRef = {
      current: {
        sonifier: {} as SonifierHandle["sonifier"],
        [Symbol.dispose]: () => {},
      },
    };

    const visualizerFrameDataRef = {
      current: {
        detection: { points: [], handDetected: false },
        sampling: { samples: new Map() },
        sonification: { tones: initialTones },
        analyser: null,
      } as VisualizerFrameData,
    };

    updateSonificationDebugFrame({ sonifierHandleRef, visualizerFrameDataRef });

    expect(visualizerFrameDataRef.current.sonification.tones).toBe(initialTones);
  });

  it("updates sonification tones when getLastFrameDebug exists", () => {
    const nextTones = new Map([
      [
        "p1",
        {
          frequency: 440,
          volume: 0.8,
          hueByte: 120,
          saturationByte: 200,
          valueByte: 220,
        },
      ],
    ]) as VisualizerFrameData["sonification"]["tones"];

    const sonifierHandleRef = {
      current: {
        sonifier: {} as SonifierHandle["sonifier"],
        extras: {
          getLastFrameDebug: () => nextTones,
        },
        [Symbol.dispose]: () => {},
      },
    };

    const visualizerFrameDataRef = {
      current: {
        detection: { points: [], handDetected: false },
        sampling: { samples: new Map() },
        sonification: { tones: new Map() },
        analyser: null,
      } as VisualizerFrameData,
    };

    updateSonificationDebugFrame({ sonifierHandleRef, visualizerFrameDataRef });

    expect(visualizerFrameDataRef.current.sonification.tones).toBe(nextTones);
  });
});
