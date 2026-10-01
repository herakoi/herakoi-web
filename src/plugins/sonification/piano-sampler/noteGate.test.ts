import { describe, expect, it } from "vitest";

import { nextNote } from "./noteGate";

// 5 notes: each band is 1/4 of the position range, boundaries at 0.125, 0.375, ...
const notes = [60, 62, 64, 67, 69];
const bandWidth = 1 / (notes.length - 1);
const off = { hysteresis: 0, minIntervalMs: 0 };

describe("nextNote", () => {
  it("plays the nearest note when the point has no previous note", () => {
    expect(nextNote(notes, 0, undefined, 0, off)).toBe(60);
    expect(nextNote(notes, 1, undefined, 0, off)).toBe(69);
  });

  it("does not retrigger the same note", () => {
    expect(nextNote(notes, 0.02, { note: 60, triggeredAt: 0 }, 1000, off)).toBeNull();
  });

  it("switches as soon as the boundary is crossed without hysteresis", () => {
    const justPastBoundary = 0.5 * bandWidth + 0.01;
    expect(nextNote(notes, justPastBoundary, { note: 60, triggeredAt: 0 }, 1000, off)).toBe(62);
  });

  it("holds the last note near the boundary with hysteresis", () => {
    const options = { hysteresis: 0.25, minIntervalMs: 0 };
    const last = { note: 60, triggeredAt: 0 };

    expect(nextNote(notes, 0.6 * bandWidth, last, 1000, options)).toBeNull();
    expect(nextNote(notes, 0.8 * bandWidth, last, 1000, options)).toBe(62);
  });

  it("applies hysteresis in both directions", () => {
    const options = { hysteresis: 0.25, minIntervalMs: 0 };
    const last = { note: 62, triggeredAt: 0 };

    expect(nextNote(notes, 0.4 * bandWidth, last, 1000, options)).toBeNull();
    expect(nextNote(notes, 0.2 * bandWidth, last, 1000, options)).toBe(60);
  });

  it("still allows jumps across several notes", () => {
    const options = { hysteresis: 0.45, minIntervalMs: 0 };
    expect(nextNote(notes, 1, { note: 60, triggeredAt: 0 }, 1000, options)).toBe(69);
  });

  it("waits for the minimum interval before changing note", () => {
    const options = { hysteresis: 0, minIntervalMs: 100 };
    const last = { note: 60, triggeredAt: 1000 };

    expect(nextNote(notes, 1, last, 1050, options)).toBeNull();
    expect(nextNote(notes, 1, last, 1100, options)).toBe(69);
  });

  it("switches right away when the last note is no longer in the scale", () => {
    const options = { hysteresis: 0.45, minIntervalMs: 0 };
    expect(nextNote(notes, 0.6 * bandWidth, { note: 61, triggeredAt: 0 }, 1000, options)).toBe(62);
  });
});
