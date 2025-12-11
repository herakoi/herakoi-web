import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Sonifier } from "./sonification";

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

describe("Sonifier", () => {
  let ctx: FakeAudioContext;

  beforeEach(() => {
    ctx = new FakeAudioContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts and updates tones by id", () => {
    const sonifier = new Sonifier(ctx as unknown as AudioContext);

    sonifier.updateTone("finger-1", { frequency: 440, volume: 0.2 });

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createGain).toHaveBeenCalledTimes(1);

    sonifier.updateTone("finger-1", { frequency: 880, volume: 0.1 });

    // No new nodes, just parameter updates
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createGain).toHaveBeenCalledTimes(1);
  });

  it("stops tones with a fade-out and cleans up", () => {
    const sonifier = new Sonifier(ctx as unknown as AudioContext);
    sonifier.updateTone("finger-1", { frequency: 440, volume: 0.2 });

    sonifier.stopTone("finger-1");

    const gain = (ctx.createGain.mock.results[0].value as FakeGain).gain;
    expect(gain.exponentialRampToValueAtTime).toHaveBeenCalled();
  });

  it("stopAll stops every active tone", async () => {
    const sonifier = new Sonifier(ctx as unknown as AudioContext);
    sonifier.updateTone("a", { frequency: 300, volume: 0.1 });
    sonifier.updateTone("b", { frequency: 500, volume: 0.2 });

    sonifier.stopAll();

    await Promise.resolve();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    const oscA = ctx.createOscillator.mock.results[0].value as FakeOscillator;
    const oscB = ctx.createOscillator.mock.results[1].value as FakeOscillator;
    expect(oscA.stop).toHaveBeenCalled();
    expect(oscB.stop).toHaveBeenCalled();
  });

  it("syncTones starts updates and silences missing ids", async () => {
    const sonifier = new Sonifier(ctx as unknown as AudioContext);
    sonifier.syncTones([
      { id: "a", params: { frequency: 300, volume: 0.1 } },
      { id: "b", params: { frequency: 500, volume: 0.2 } },
    ]);

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);

    sonifier.syncTones([{ id: "b", params: { frequency: 550, volume: 0.15 } }]);

    await Promise.resolve();

    const oscA = ctx.createOscillator.mock.results[0].value as FakeOscillator;
    expect(oscA.stop).toHaveBeenCalled();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });
});
