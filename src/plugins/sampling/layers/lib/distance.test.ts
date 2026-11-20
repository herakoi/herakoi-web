import { describe, expect, it } from "vitest";
import { distanceToData } from "./distance";

const NaN_ = Number.NaN;

/** Brute-force reference: nearest finite pixel, as a fraction of the longer side. */
const bruteForce = (data: Float32Array, width: number, height: number) => {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let best = Number.POSITIVE_INFINITY;
      for (let j = 0; j < height; j += 1) {
        for (let i = 0; i < width; i += 1) {
          if (Number.isFinite(data[j * width + i])) {
            best = Math.min(best, Math.hypot(i - x, j - y));
          }
        }
      }
      out[y * width + x] = best / Math.max(width, height);
    }
  }
  return out;
};

describe("distanceToData", () => {
  it("is null without blank pixels or without any data", () => {
    expect(distanceToData(Float32Array.from([1, 2, 3, 4]), 2, 2)).toBeNull();
    expect(distanceToData(Float32Array.from([NaN_, NaN_]), 2, 1)).toBeNull();
  });

  it("measures the distance to the nearest data pixel", () => {
    // 5x1 row with data only at the left end.
    const result = distanceToData(Float32Array.from([1, NaN_, NaN_, NaN_, NaN_]), 5, 1);
    expect(Array.from(result ?? [])).toEqual([0, 0.2, 0.4, 0.6, 0.8].map(Math.fround));
  });

  it("matches a brute-force search on a random image", () => {
    const width = 13;
    const height = 9;
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const data = Float32Array.from({ length: width * height }, () => (random() < 0.1 ? 1 : NaN_));
    data[0] = 1;
    const result = distanceToData(data, width, height);
    const expected = bruteForce(data, width, height);
    expect(result).not.toBeNull();
    result?.forEach((value, index) => {
      expect(value).toBeCloseTo(expected[index], 5);
    });
  });
});
