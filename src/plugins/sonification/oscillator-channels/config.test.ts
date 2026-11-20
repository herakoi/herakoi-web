import { describe, expect, it } from "vitest";
import {
  type ChannelOscillatorConfig,
  defaultChannelOscillatorConfig,
  effectSlotsOf,
} from "./config";

describe("effectSlotsOf", () => {
  it("keeps a config's effect slots", () => {
    const effects = [
      {
        id: "effect-1",
        channel: "layer.0",
        invert: false,
        noData: "pulse" as const,
        kind: "pan" as const,
        amount: 1,
      },
    ];
    expect(effectSlotsOf({ ...defaultChannelOscillatorConfig, effects })).toBe(effects);
  });

  it("turns the earlier single effect into one slot", () => {
    const saved = {
      ...defaultChannelOscillatorConfig,
      effectChannel: "layer.3",
      effectInvert: true,
      effectNoData: "proximity",
      effectKind: "lowpass",
      effectAmount: 0.4,
    } as ChannelOscillatorConfig;
    expect(effectSlotsOf(saved)).toEqual([
      {
        id: "effect-1",
        channel: "layer.3",
        invert: true,
        noData: "proximity",
        kind: "lowpass",
        amount: 0.4,
      },
    ]);
  });

  it("has no effects by default", () => {
    expect(effectSlotsOf(defaultChannelOscillatorConfig)).toEqual([]);
  });
});
