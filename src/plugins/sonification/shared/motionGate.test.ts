import { describe, expect, it, vi } from "vitest";
import { createMotionGate } from "./motionGate";

const makeContext = () => ({
  createGain: vi.fn(() => ({
    disconnect: vi.fn(),
    gain: {
      value: 0,
      setTargetAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
  })),
});

const setup = (mode: Parameters<typeof createMotionGate>[1]) => {
  const ctx = makeContext();
  const gate = createMotionGate(ctx as unknown as BaseAudioContext, mode);
  const gain = ctx.createGain.mock.results[0].value.gain;
  return { gate, gain };
};

describe("createMotionGate", () => {
  it("passes the voice through in continuous mode and without motion data", () => {
    const { gate, gain } = setup("moving");
    gate.apply("moving", null, 0);
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 0, expect.any(Number));
  });

  it("sounds only while moving, louder when faster", () => {
    const { gate, gain } = setup("moving");
    expect(gain.value).toBe(0);
    gate.apply("moving", { speed: 0, moving: false, note: false }, 0);
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, expect.any(Number));
    gate.apply("moving", { speed: 0.1, moving: true, note: false }, 0);
    const slow = gain.setTargetAtTime.mock.calls.at(-1)[0];
    gate.apply("moving", { speed: 1, moving: true, note: false }, 0);
    const fast = gain.setTargetAtTime.mock.calls.at(-1)[0];
    expect(slow).toBeGreaterThan(0.5);
    expect(fast).toBe(1);
  });

  it("restarts a decaying envelope on each due note when plucked", () => {
    const { gate, gain } = setup("plucked");
    gate.apply("plucked", { speed: 0.3, moving: true, note: false }, 1);
    expect(gain.setValueAtTime).not.toHaveBeenCalled();
    gate.apply("plucked", { speed: 0.3, moving: true, note: true }, 2);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(1, 2);
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, expect.any(Number));
  });

  it("plucks once in moving mode for a note due while still", () => {
    const { gate, gain } = setup("moving");
    gate.apply("moving", { speed: 0, moving: false, note: true }, 3);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(1, 3);
  });
});
