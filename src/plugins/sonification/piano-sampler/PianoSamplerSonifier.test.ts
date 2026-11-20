/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from "vitest";

vi.mock("tone", () => ({
  // Before a user gesture Chrome keeps resume() pending instead of rejecting.
  start: vi.fn(() => new Promise<void>(() => {})),
  getContext: () => ({ rawContext: { state: "suspended", setSinkId: () => {} } }),
  setContext: vi.fn(),
  now: () => 0,
  Frequency: vi.fn(),
  Sampler: class {
    constructor({ onload }: { onload: () => void }) {
      queueMicrotask(onload);
    }
    volume = { value: 0 };
    connect() {}
    disconnect() {}
    dispose() {}
  },
}));

vi.mock("#src/plugins/sonification/shared/SinkOutputRouter", () => ({
  SinkOutputRouter: class {
    getInputNode() {}
    setOutputGain() {}
    dispose() {}
  },
}));

import { PianoSamplerSonifier } from "./PianoSamplerSonifier";

describe("PianoSamplerSonifier", () => {
  it("initializes while the audio context waits for a user gesture", async () => {
    const sonifier = new PianoSamplerSonifier();
    const result = await Promise.race([
      sonifier.initialize(),
      new Promise((resolve) => setTimeout(() => resolve("stalled"), 100)),
    ]);
    expect(result).toBeUndefined();
  });
});
