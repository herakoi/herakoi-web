import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOscillatorSonifier } from "#src/sonification/oscillator/factory";
import { OscillatorSonifier } from "#src/sonification/oscillator/OscillatorSonifier";
import type { OscillatorControls } from "#src/sonification/oscillator/uiControls";

vi.mock("#src/sonification/oscillator/OscillatorSonifier");
vi.mock("#src/sonification/oscillator/uiControls");

describe("getOscillatorSonifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("creates sonifier once, reuses singleton, and attaches controls", () => {
    const mockControls = {
      state: {
        minFreq: 100,
        maxFreq: 800,
        minVol: 0.01,
        maxVol: 0.2,
        oscillatorType: "sine" as OscillatorType,
      },
      attach: vi.fn(),
    } as unknown as OscillatorControls;

    const first = getOscillatorSonifier(mockControls);
    const second = getOscillatorSonifier(mockControls);

    expect(first).toBe(second);
    expect(OscillatorSonifier).toHaveBeenCalledTimes(1);
    expect(mockControls.attach).toHaveBeenCalledTimes(1);
  });
});
