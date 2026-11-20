import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelOscillatorSonifier } from "./ChannelOscillatorSonifier";

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});
const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });

class FakeAudioContext {
  public readonly currentTime = 0;
  public state: AudioContextState = "running";
  public destination = {};
  public setSinkId = vi.fn(async (_sinkId: string) => {});
  public createOscillator = vi.fn(() => ({
    ...node(),
    type: "sine",
    frequency: param(),
    detune: param(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  public createGain = vi.fn(() => ({ ...node(), gain: param() }));
  public createStereoPanner = vi.fn(() => ({ ...node(), pan: param() }));
  public createWaveShaper = vi.fn(() => ({ ...node(), curve: null }));
}

const channels = [{ key: "layer.0", label: "1. VELOCITY", min: 0, max: 1 }];

describe("ChannelOscillatorSonifier", () => {
  let ctx: FakeAudioContext;
  const create = (options: ConstructorParameters<typeof ChannelOscillatorSonifier>[1]) =>
    new ChannelOscillatorSonifier(ctx as unknown as AudioContext, {
      minFreq: 200,
      maxFreq: 700,
      minVol: 0,
      maxVol: 1,
      channels,
      ...options,
    });

  beforeEach(() => {
    ctx = new FakeAudioContext();
  });

  it("drives pitch and volume from the bound channels, normalised by their range", async () => {
    const sonifier = create({
      pitchBinding: { channel: "layer.0", invert: false, noData: "silence" },
      volumeBinding: { channel: "valueByte", invert: true, noData: "silence" },
    });
    await sonifier.initialize();

    sonifier.processSamples(new Map([["a", { data: { "layer.0": 0.5, valueByte: 51 } }]]));

    const frame = sonifier.getLastFrameDebug().get("a");
    expect(frame?.frequency).toBeCloseTo(450);
    expect(frame?.volume).toBeCloseTo(0.8);
  });

  it("stays silent where the pitch or volume channel has no data", async () => {
    const sonifier = create({
      pitchBinding: { channel: "layer.0", invert: false, noData: "silence" },
    });
    await sonifier.initialize();

    sonifier.processSamples(new Map([["a", { data: { hueByte: 10, valueByte: 200 } }]]));

    expect(ctx.createOscillator).not.toHaveBeenCalled();
    expect(sonifier.getLastFrameDebug().size).toBe(0);
  });

  it("keeps the classic hue → pitch, value → volume mapping by default", async () => {
    const sonifier = new ChannelOscillatorSonifier(ctx as unknown as AudioContext, {
      minFreq: 200,
      maxFreq: 700,
      minVol: 0,
      maxVol: 1,
    });
    await sonifier.initialize();

    sonifier.processSamples(new Map([["a", { data: { hueByte: 255, valueByte: 0 } }]]));

    expect(sonifier.getLastFrameDebug().get("a")).toMatchObject({ frequency: 700, volume: 0 });
  });

  it("applies the effect from its channel and leaves it neutral without data when asked", async () => {
    const sonifier = create({
      effectBinding: { channel: "layer.0", invert: false, noData: "neutral" },
      effectKind: "pan",
      effectAmount: 1,
    });
    await sonifier.initialize();

    sonifier.processSamples(
      new Map([["a", { data: { hueByte: 0, valueByte: 255, "layer.0": 1 } }]]),
    );
    sonifier.processSamples(new Map([["a", { data: { hueByte: 0, valueByte: 255 } }]]));

    const panner = ctx.createStereoPanner.mock.results[0]?.value;
    expect(panner.pan.setTargetAtTime.mock.calls.map((call: number[]) => call[0])).toEqual([1, 0]);
  });

  it("pulses the tone where the effect channel has no data, keeping the effect neutral", async () => {
    const sonifier = create({
      effectBinding: { channel: "layer.0", invert: false, noData: "pulse" },
      effectKind: "pan",
      effectAmount: 1,
    });
    await sonifier.initialize();

    sonifier.processSamples(new Map([["a", { data: { hueByte: 0, valueByte: 255 } }]]));

    // Gains in order: master, voice, pulse stage, pulse depth.
    const pulseDepth = ctx.createGain.mock.results.at(-1)?.value;
    expect(pulseDepth.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 0, expect.any(Number));
    const panner = ctx.createStereoPanner.mock.results[0]?.value;
    expect(panner.pan.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, expect.any(Number));

    sonifier.processSamples(
      new Map([["a", { data: { hueByte: 0, valueByte: 255, "layer.0": 1 } }]]),
    );
    expect(pulseDepth.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, expect.any(Number));
  });

  it("silences the voice or plays the mid value, as each binding asks", async () => {
    const silent = create({
      effectBinding: { channel: "layer.0", invert: false, noData: "silence" },
      effectKind: "pan",
    });
    await silent.initialize();
    silent.processSamples(new Map([["a", { data: { hueByte: 0, valueByte: 255 } }]]));
    expect(silent.getLastFrameDebug().size).toBe(0);

    const neutral = create({
      pitchBinding: { channel: "layer.0", invert: false, noData: "neutral" },
    });
    await neutral.initialize();
    neutral.processSamples(new Map([["a", { data: { valueByte: 255 } }]]));
    expect(neutral.getLastFrameDebug().get("a")?.frequency).toBeCloseTo(450);
  });

  it("pulses faster the closer the nearest data is", async () => {
    const sonifier = create({
      channels: [
        { key: "layer.0", label: "1. Z", min: 0, max: 1, distanceKey: "layer.0:distance" },
      ],
      proximityReach: 0.2,
      effectBinding: { channel: "layer.0", invert: false, noData: "proximity" },
      effectKind: "pan",
    });
    await sonifier.initialize();
    const rateAt = (distance: number) => {
      sonifier.processSamples(
        new Map([["a", { data: { hueByte: 0, valueByte: 255, "layer.0:distance": distance } }]]),
      );
      // Oscillators in order: voice, pulse LFO.
      const lfo = ctx.createOscillator.mock.results[1]?.value;
      return lfo.frequency.setTargetAtTime.mock.calls.at(-1)?.[0] as number;
    };

    expect(rateAt(0.5)).toBeCloseTo(1);
    expect(rateAt(0.1)).toBeGreaterThan(1);
    expect(rateAt(0.1)).toBeLessThan(rateAt(0.01));
    expect(rateAt(0)).toBeCloseTo(8);
  });
});
