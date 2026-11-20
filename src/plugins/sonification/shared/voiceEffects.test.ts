import { describe, expect, it, vi } from "vitest";
import { createVoiceEffect } from "./voiceEffects";

const param = () => ({ value: 0, setTargetAtTime: vi.fn() });
const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });

const makeContext = () => ({
  createStereoPanner: vi.fn(() => ({ ...node(), pan: param() })),
  createBiquadFilter: vi.fn(() => ({ ...node(), type: "", Q: param(), frequency: param() })),
  createOscillator: vi.fn(() => ({ ...node(), frequency: param(), start: vi.fn(), stop: vi.fn() })),
  createGain: vi.fn(() => ({ ...node(), gain: param() })),
  createDelay: vi.fn(() => ({ ...node(), delayTime: param() })),
});

const setup = (kind: Parameters<typeof createVoiceEffect>[1]) => {
  const ctx = makeContext();
  const osc = { detune: param() } as unknown as OscillatorNode;
  const voice = node() as unknown as AudioNode;
  const destination = {} as AudioNode;
  const effect = createVoiceEffect(
    ctx as unknown as BaseAudioContext,
    kind,
    osc,
    voice,
    destination,
  );
  return { ctx, osc, voice, effect };
};

describe("createVoiceEffect", () => {
  it("pans from left to right with the value, centred without data", () => {
    const { ctx, effect } = setup("pan");
    const panner = ctx.createStereoPanner.mock.results[0].value;
    effect.apply(0, 1, 0);
    effect.apply(1, 0.5, 0);
    effect.apply(null, 1, 0);
    expect(panner.pan.setTargetAtTime.mock.calls.map((call: number[]) => call[0])).toEqual([
      -1, 0.5, 0,
    ]);
  });

  it("closes the low-pass filter for low values and leaves it open without data", () => {
    const { ctx, effect } = setup("lowpass");
    const filter = ctx.createBiquadFilter.mock.results[0].value;
    effect.apply(0, 1, 0);
    effect.apply(null, 1, 0);
    const [closed, open] = filter.frequency.setTargetAtTime.mock.calls.map(
      (call: number[]) => call[0],
    );
    expect(closed).toBeCloseTo(120);
    expect(open).toBeCloseTo(16000);
  });

  it("drives vibrato depth in cents and stops its LFO on dispose", () => {
    const { ctx, effect } = setup("vibrato");
    const lfo = ctx.createOscillator.mock.results[0].value;
    const depth = ctx.createGain.mock.results[0].value;
    effect.apply(1, 1, 0);
    expect(depth.gain.setTargetAtTime).toHaveBeenCalledWith(100, 0, expect.any(Number));
    effect.dispose();
    expect(lfo.stop).toHaveBeenCalled();
  });

  it("mixes in chorus copies with the value", () => {
    const { ctx, effect } = setup("chorus");
    const wet = ctx.createGain.mock.results[1].value;
    effect.apply(0.5, 1, 0);
    expect(wet.gain.setTargetAtTime).toHaveBeenCalledWith(0.35, 0, expect.any(Number));
    expect(ctx.createDelay).toHaveBeenCalledTimes(2);
  });

  it("connects the voice straight through when no effect is chosen", () => {
    const { voice } = setup("none");
    expect(voice.connect).toHaveBeenCalledTimes(1);
  });
});
