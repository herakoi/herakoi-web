import { describe, expect, it } from "vitest";
import {
  applyHomography,
  invert3,
  reprojectionRms,
  solveHomography,
  type Vec2,
} from "./homography";

const H_TRUE = [1.2, 0.15, 30, -0.05, 0.9, 12, 0.0004, -0.0002, 1];
const project = (pts: Vec2[]) => pts.map(([x, y]) => applyHomography(H_TRUE, x, y) as Vec2);

describe("homography", () => {
  it("recovers an exact homography from 4 points", () => {
    const src: Vec2[] = [
      [0, 0],
      [640, 0],
      [640, 360],
      [0, 360],
    ];
    const h = solveHomography(src, project(src));
    expect(h).not.toBeNull();
    const [x, y] = applyHomography(h as number[], 320, 180);
    const [ex, ey] = applyHomography(H_TRUE, 320, 180);
    expect(x).toBeCloseTo(ex, 6);
    expect(y).toBeCloseTo(ey, 6);
  });

  it("fits many noisy points in the least-squares sense", () => {
    const src: Vec2[] = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) src.push([i * 80, j * 70]);
    const noisy = project(src).map(
      ([x, y], k) => [x + ((k * 7) % 3) * 0.1, y - ((k * 5) % 3) * 0.1] as Vec2,
    );
    const h = solveHomography(src, noisy) as number[];
    expect(reprojectionRms(h, src, noisy)).toBeLessThan(0.2);
  });

  it("inverts", () => {
    const inv = invert3(H_TRUE) as number[];
    const [x, y] = applyHomography(H_TRUE, 100, 50);
    const [bx, by] = applyHomography(inv, x, y);
    expect(bx).toBeCloseTo(100, 6);
    expect(by).toBeCloseTo(50, 6);
  });

  it("rejects degenerate input", () => {
    const line: Vec2[] = [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ];
    expect(solveHomography(line, line)).toBeNull();
    expect(solveHomography(line.slice(0, 3), line.slice(0, 3))).toBeNull();
  });
});
