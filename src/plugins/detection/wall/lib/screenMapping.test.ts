import { describe, expect, it } from "vitest";
import { applyHomography, invert3, solveHomography, type Vec2 } from "./homography";
import {
  findScreenQuad,
  type MappingIO,
  MappingUnreliableError,
  mapScreen,
  type Pattern,
} from "./screenMapping";
import type { Gray } from "./vision";

// A screen seen at an angle: corners of the viewport in camera pixels (like the SMART board).
const ASPECT = 16 / 9;
const W = 640;
const H = 360;
const CORNERS: Vec2[] = [
  [70, 30],
  [315, 88],
  [312, 222],
  [58, 222],
];
const camToScreen = solveHomography(CORNERS, [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]) as number[];

type Rect = { x0: number; y0: number; x1: number; y1: number };

/** Camera image of the screen showing `pattern`, optionally with a person (rect) in front. */
const render = (pattern: Pattern, occluder?: Rect): Gray => {
  const data = new Float32Array(W * H);
  // Dot radius is a share of the viewport's short side → radii in normalised u and v.
  const aspect = ASPECT;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Room background with some texture, plus a bright window that never changes.
      let v = 40 + ((x * 13 + y * 7) % 11) + (x > 500 && y < 150 ? 160 : 0);
      const [u, s] = applyHomography(camToScreen, x + 0.5, y + 0.5);
      const onScreen = u >= 0 && u <= 1 && s >= 0 && s <= 1;
      if (onScreen) {
        v = 12;
        if (pattern.kind === "white") v = 235;
        if (pattern.kind === "dots") {
          const ru = pattern.radius * Math.min(1, 1 / aspect);
          const rv = pattern.radius * Math.min(aspect, 1);
          for (const [du, dv] of pattern.dots) {
            if (((u - du) / ru) ** 2 + ((s - dv) / rv) ** 2 <= 1) v = 235;
          }
        }
      }
      if (occluder && x >= occluder.x0 && x < occluder.x1 && y >= occluder.y0 && y < occluder.y1) {
        v = 55;
      }
      data[y * W + x] = v;
    }
  }
  return { data, width: W, height: H };
};

const fakeIO = (occluder?: Rect): MappingIO => {
  let current: Pattern | null = null;
  return {
    showPattern: async (p) => {
      current = p;
    },
    capture: async () => render(current ?? { kind: "black" }, occluder),
    wait: async () => {},
  };
};

describe("screen mapping", () => {
  it("finds the lit screen quad", () => {
    const quad = findScreenQuad(render({ kind: "white" }), render({ kind: "black" }));
    expect(quad).not.toBeNull();
    quad?.corners.forEach((c, i) => {
      expect(Math.hypot(c[0] - CORNERS[i][0], c[1] - CORNERS[i][1])).toBeLessThan(3);
    });
  });

  it("maps camera pixels to the screen through the dot grid", async () => {
    const result = await mapScreen(fakeIO(), { viewportAspect: ASPECT, settleMs: 0 });
    expect(result).not.toBeInstanceOf(Error);
    if (result instanceof Error) return;
    expect(result.matchedDots).toBeGreaterThanOrEqual(30);
    // Check a few camera points against the ground truth.
    for (const p of [
      [120, 80],
      [250, 150],
      [80, 200],
    ] as Vec2[]) {
      const [u, v] = applyHomography(result.homography, p[0], p[1]);
      const [eu, ev] = applyHomography(camToScreen, p[0], p[1]);
      expect(Math.abs(u - eu)).toBeLessThan(0.01);
      expect(Math.abs(v - ev)).toBeLessThan(0.01);
    }
    const inv = invert3(result.homography) as number[];
    const [cx, cy] = applyHomography(inv, 0, 0);
    expect(Math.hypot(cx - CORNERS[0][0], cy - CORNERS[0][1])).toBeLessThan(2);
  });

  it("still maps accurately when a person hides part of the screen", async () => {
    // Someone standing in front of the top-left part of the screen while it flashes.
    const result = await mapScreen(fakeIO({ x0: 60, y0: 20, x1: 150, y1: 120 }), {
      viewportAspect: ASPECT,
      settleMs: 0,
    });
    expect(result).not.toBeInstanceOf(Error);
    if (result instanceof Error) return;
    for (const p of [
      [250, 150],
      [100, 200],
      [290, 110],
    ] as Vec2[]) {
      const [u, v] = applyHomography(result.homography, p[0], p[1]);
      const [eu, ev] = applyHomography(camToScreen, p[0], p[1]);
      expect(Math.abs(u - eu)).toBeLessThan(0.01);
      expect(Math.abs(v - ev)).toBeLessThan(0.01);
    }
  });

  it("refuses a mapping when most of the screen is hidden", async () => {
    const result = await mapScreen(fakeIO({ x0: 40, y0: 0, x1: 240, y1: 260 }), {
      viewportAspect: ASPECT,
      settleMs: 0,
    });
    expect(result).toBeInstanceOf(Error);
    if (result instanceof MappingUnreliableError) {
      expect(result.matchedDots).toBeLessThan(24);
    }
  });

  it("reports when no screen is visible", async () => {
    const io = fakeIO();
    io.capture = async () => render({ kind: "black" });
    const result = await mapScreen(io, { viewportAspect: ASPECT, settleMs: 0 });
    expect(result).toBeInstanceOf(Error);
  });
});
