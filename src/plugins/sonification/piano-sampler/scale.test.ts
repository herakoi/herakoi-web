import { describe, expect, it } from "vitest";

import { buildScaleNotes, pickScaleNote } from "./scale";

describe("buildScaleNotes", () => {
  it("keeps every semitone for the chromatic scale", () => {
    expect(buildScaleNotes(60, 64, "chromatic")).toEqual([60, 61, 62, 63, 64]);
  });

  it("keeps only C major notes for the major scale", () => {
    expect(buildScaleNotes(60, 72, "major")).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it("keeps only C major pentatonic notes for the pentatonic scale", () => {
    expect(buildScaleNotes(60, 72, "pentatonic")).toEqual([60, 62, 64, 67, 69, 72]);
  });

  it("covers the default range with 20 pentatonic notes", () => {
    expect(buildScaleNotes(36, 83, "pentatonic")).toHaveLength(20);
  });

  it("falls back to every note in range when the scale has none there", () => {
    expect(buildScaleNotes(61, 61, "pentatonic")).toEqual([61]);
  });
});

describe("pickScaleNote", () => {
  const notes = [60, 62, 64, 67, 69];

  it("maps the ends of the range to the lowest and highest notes", () => {
    expect(pickScaleNote(notes, 0)).toBe(60);
    expect(pickScaleNote(notes, 1)).toBe(69);
  });

  it("only returns notes from the scale", () => {
    for (let i = 0; i <= 100; i++) {
      expect(notes).toContain(pickScaleNote(notes, i / 100));
    }
  });

  it("clamps positions outside [0, 1]", () => {
    expect(pickScaleNote(notes, -0.5)).toBe(60);
    expect(pickScaleNote(notes, 1.5)).toBe(69);
  });

  it("matches the previous chromatic mapping", () => {
    const chromatic = buildScaleNotes(36, 83, "chromatic");
    for (let hue = 0; hue <= 300; hue += 7) {
      const previous = 36 + Math.round((hue / 300) * (83 - 36));
      expect(pickScaleNote(chromatic, hue / 300)).toBe(previous);
    }
  });
});
