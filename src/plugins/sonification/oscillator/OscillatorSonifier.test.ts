import { beforeEach, describe, expect, it, vi } from "vitest";

import { OscillatorSonifier } from "./OscillatorSonifier";

class FakeOscillator {
  public frequency = { setValueAtTime: vi.fn(), value: 0 };
  public type: OscillatorType = "sine";
  public connect = vi.fn();
  public start = vi.fn();
  public stop = vi.fn();
  public disconnect = vi.fn();
}

class FakeGain {
  public gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), value: 1 };
  public connect = vi.fn();
  public disconnect = vi.fn();
}

class FakeAudioContext {
  public readonly currentTime = 0;
  public destination = {};
  public createOscillator = vi.fn(() => new FakeOscillator());
  public createGain = vi.fn(() => new FakeGain());
}

const makeSample = (hue: number, value: number) => ({
  data: { hueByte: hue, valueByte: value },
});

describe("OscillatorSonifier", () => {
  let ctx: FakeAudioContext;

  beforeEach(() => {
    ctx = new FakeAudioContext();
  });

  it("initializes when provided an AudioContext", async () => {
    const sonifier = new OscillatorSonifier(ctx as unknown as AudioContext, {
      oscillatorType: "triangle",
    });

    await sonifier.initialize();

    const osc = ctx.createOscillator.mock.results[0]?.value as FakeOscillator | undefined;
    // No oscillator created until processSamples, so expect none yet
    expect(osc).toBeUndefined();
  });

  it("creates and updates tones from samples", async () => {
    const sonifier = new OscillatorSonifier(ctx as unknown as AudioContext, {
      minFreq: 200,
      maxFreq: 700,
      minVol: 0,
      maxVol: 20,
    });
    await sonifier.initialize();

    const samples = new Map([
      ["a", makeSample(0, 128)],
      ["b", makeSample(255, 255)],
    ]);

    sonifier.processSamples(samples);

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    const oscA = ctx.createOscillator.mock.results[0].value as FakeOscillator;
    expect(oscA.frequency.setValueAtTime).toHaveBeenCalled();

    // Update: remove "a" and tweak "b"
    const samples2 = new Map([["b", makeSample(128, 64)]]);
    sonifier.processSamples(samples2);

    // "a" should be scheduled to stop
    await Promise.resolve();
    const oscB = ctx.createOscillator.mock.results[1].value as FakeOscillator;
    expect(oscB.stop).not.toHaveBeenCalled();
  });

  it("applies configure updates to existing oscillators", async () => {
    const sonifier = new OscillatorSonifier(ctx as unknown as AudioContext, {
      oscillatorType: "sine",
    });
    await sonifier.initialize();

    sonifier.processSamples(new Map([["a", makeSample(0, 128)]]));
    const osc = ctx.createOscillator.mock.results[0].value as FakeOscillator;
    expect(osc.type).toBe("sine");

    sonifier.configure({ oscillatorType: "square" });
    expect(osc.type).toBe("square");
  });

  it("stops all tones on stop()", async () => {
    const sonifier = new OscillatorSonifier(ctx as unknown as AudioContext, {
      fadeMs: 50, // Use shorter fade for test
    });
    await sonifier.initialize();

    sonifier.processSamples(
      new Map([
        ["a", makeSample(0, 255)],
        ["b", makeSample(128, 128)],
      ]),
    );

    sonifier.stop();
    // Wait for fade to complete
    await new Promise((resolve) => setTimeout(resolve, 60));

    const oscA = ctx.createOscillator.mock.results[0].value as FakeOscillator;
    const oscB = ctx.createOscillator.mock.results[1].value as FakeOscillator;
    expect(oscA.stop).toHaveBeenCalled();
    expect(oscB.stop).toHaveBeenCalled();
  });
});
