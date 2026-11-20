/**
 * Automatic camera → screen mapping using the screen itself as the target.
 *
 * 1. Full black, then full white: the white − black difference isolates the
 *    lit screen in the camera image → coarse quad → coarse homography.
 * 2. A grid of white dots on black at known screen positions: each dot is
 *    found near its predicted camera position and the homography is refit
 *    on all matches (least squares, one outlier-rejection pass).
 *
 * The camera-side work only needs averaged grey frames, so the procedure is
 * independent of the DOM: `MappingIO` supplies pattern display and capture.
 */

import {
  applyHomography,
  invert3,
  reprojectionRms,
  solveHomography,
  type Vec2,
} from "./homography";
import {
  type Blob,
  blobCentroids,
  boundaryPoints,
  convexHull,
  dilate,
  erode,
  type Gray,
  largestComponent,
  type Mask,
  maxAreaQuad,
  orderCorners,
  otsuThreshold,
  positiveDiff,
  threshold,
} from "./vision";

export type Pattern =
  | { kind: "black" }
  | { kind: "white" }
  /** Dots in normalised screen coordinates; radius as a fraction of the viewport's short side. */
  | { kind: "dots"; dots: Vec2[]; radius: number }
  /** Shown before the mapping so whoever started it can step out of the camera view. */
  | { kind: "countdown"; seconds: number };

export type MappingStep = "black" | "white" | "dots" | "coding" | "solving";

export type MappingIO = {
  /** Show a pattern full screen (null hides it); resolves once it has been painted. */
  showPattern: (pattern: Pattern | null) => Promise<void>;
  /** Average of `frames` camera frames as luma. */
  capture: (frames: number) => Promise<Gray>;
  wait: (ms: number) => Promise<void>;
  progress?: (step: MappingStep) => void;
  signal?: AbortSignal;
};

export type ScreenMapping = {
  /** Camera pixels → normalised screen coordinates (row-major 3×3). */
  homography: number[];
  /** Screen corners (TL, TR, BR, BL) in camera pixels. */
  corners: Vec2[];
  cameraWidth: number;
  cameraHeight: number;
  matchedDots: number;
  totalDots: number;
  /** Reprojection RMS of the dots, in normalised screen units. */
  rms: number;
  diagnostics: MappingDiagnostics;
};

/** What each stage found, for troubleshooting a mapping on site. */
export type MappingDiagnostics = {
  /** Share of the camera image covered by the lit screen. */
  screenShare: number;
  blobs: number;
  /** Dots identified by their code, and how many of those the fit kept. */
  decoded: number;
  codedMatched: number;
  /** Dots matched by position (fallback), when it ran. */
  proximityMatched: number | null;
  rms: number;
  method: "coded" | "proximity" | "none";
};

export const DOT_COLS = 8;
export const DOT_ROWS = 5;
export const DOT_MARGIN = 0.08;
export const DOT_RADIUS = 0.025;
const FRAMES_PER_PATTERN = 5;
const FRAMES_PER_CODE = 3;
/** Bits needed to number the columns and rows from 1 (0 = "never lit" stays invalid). */
const COL_BITS = Math.ceil(Math.log2(DOT_COLS + 1));
const ROW_BITS = Math.ceil(Math.log2(DOT_ROWS + 1));
const SCREEN_CORNERS: Vec2[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export class ScreenNotFoundError extends Error {
  constructor() {
    super("The screen was not found in the camera image.");
    this.name = "ScreenNotFoundError";
  }
}

/** Too few dots found or too large an error: the previous mapping is kept. */
export class MappingUnreliableError extends Error {
  matchedDots: number;
  totalDots: number;
  diagnostics: MappingDiagnostics;
  constructor(matchedDots: number, totalDots: number, diagnostics: MappingDiagnostics) {
    super(`Only ${matchedDots} of ${totalDots} dots were found reliably.`);
    this.matchedDots = matchedDots;
    this.totalDots = totalDots;
    this.diagnostics = diagnostics;
    this.name = "MappingUnreliableError";
  }
}

/** A mapping must match at least this share of the dots… */
const MIN_MATCHED_SHARE = 0.6;
/** …with a reprojection RMS below this (normalised screen units, ≈ 4–6 CSS px). */
const MAX_RMS = 0.006;

export class MappingAbortedError extends Error {
  constructor() {
    super("Screen mapping was cancelled.");
    this.name = "MappingAbortedError";
  }
}

export const dotGrid = (cols = DOT_COLS, rows = DOT_ROWS, margin = DOT_MARGIN): Vec2[] => {
  const dots: Vec2[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push([
        margin + ((1 - 2 * margin) * c) / (cols - 1),
        margin + ((1 - 2 * margin) * r) / (rows - 1),
      ]);
    }
  }
  return dots;
};

/** Finds the lit screen from a white and a black capture. */
export const findScreenQuad = (white: Gray, black: Gray) => {
  const diff = positiveDiff(white, black);
  const t = Math.max(otsuThreshold(diff), 12);
  // Opening removes thin bridges to reflections on walls or the floor.
  const opened = dilate(erode(threshold(diff, t), 2), 2);
  const comp = largestComponent(opened);
  if (!comp || comp.area < 0.005 * white.width * white.height) return null;
  const hull = convexHull(boundaryPoints(comp.mask));
  if (hull.length < 4) return null;
  return { corners: orderCorners(maxAreaQuad(hull)), mask: comp.mask, area: comp.area };
};

export const findDots = (dots: Gray, black: Gray, region: Mask, expectedArea: number) => {
  const diff = positiveDiff(dots, black);
  const t = Math.max(otsuThreshold(diff, region), 15);
  const mask = threshold(diff, t, region);
  return blobCentroids(mask, diff, Math.max(2, expectedArea * 0.15), expectedArea * 6 + 50);
};

/** Greedy nearest matching of predicted dot positions to detected blobs. */
export const matchDots = (
  predicted: readonly Vec2[],
  blobs: ReadonlyArray<{ x: number; y: number }>,
  maxDist: number,
) => {
  const pairs: Array<{ dot: number; blob: number; d: number }> = [];
  for (let i = 0; i < predicted.length; i++) {
    for (let j = 0; j < blobs.length; j++) {
      const d = Math.hypot(predicted[i][0] - blobs[j].x, predicted[i][1] - blobs[j].y);
      if (d <= maxDist) pairs.push({ dot: i, blob: j, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedDot = new Set<number>();
  const usedBlob = new Set<number>();
  const matches: Array<{ dot: number; blob: number }> = [];
  for (const p of pairs) {
    if (usedDot.has(p.dot) || usedBlob.has(p.blob)) continue;
    usedDot.add(p.dot);
    usedBlob.add(p.blob);
    matches.push({ dot: p.dot, blob: p.blob });
  }
  return matches;
};

const quadArea = (q: readonly Vec2[]) =>
  Math.abs(
    q.reduce((s, a, i) => {
      const b = q[(i + 1) % q.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  ) / 2;

/** Refines a homography from dot correspondences, with one outlier-rejection pass. */
const refine = (cam: Vec2[], screen: Vec2[]) => {
  let h = solveHomography(cam, screen);
  if (!h) return null;
  const residuals = cam.map((p, i) => {
    const [u, v] = applyHomography(h as number[], p[0], p[1]);
    return Math.hypot(u - screen[i][0], v - screen[i][1]);
  });
  const median = [...residuals].sort((a, b) => a - b)[Math.floor(residuals.length / 2)];
  const keep = residuals.map((r) => r <= Math.max(3 * median, 0.004));
  const camIn = cam.filter((_, i) => keep[i]);
  const scrIn = screen.filter((_, i) => keep[i]);
  if (camIn.length >= 6 && camIn.length < cam.length) {
    h = solveHomography(camIn, scrIn) ?? h;
  }
  return { h, cam: camIn, screen: scrIn };
};

/** Mean of `diff` over a small disc around a blob centre. */
const discMean = (diff: Gray, b: Blob) => {
  const r = Math.max(1.5, 0.7 * Math.sqrt(b.area / Math.PI));
  let sum = 0;
  let n = 0;
  for (let y = Math.floor(b.y - r); y <= Math.ceil(b.y + r); y++) {
    if (y < 0 || y >= diff.height) continue;
    for (let x = Math.floor(b.x - r); x <= Math.ceil(b.x + r); x++) {
      if (x < 0 || x >= diff.width || (x - b.x) ** 2 + (y - b.y) ** 2 > r * r) continue;
      sum += diff.data[y * diff.width + x];
      n++;
    }
  }
  return n ? sum / n : 0;
};

/**
 * Dot (column, row) of each blob from the coded frames: in frame k of an axis only the dots
 * whose (index + 1) has bit k set are lit, so each blob's on/off sequence spells its index.
 */
export const decodeDots = (
  blobs: readonly Blob[],
  full: Gray,
  black: Gray,
  colFrames: readonly Gray[],
  rowFrames: readonly Gray[],
) => {
  const fullDiff = positiveDiff(full, black);
  const reference = blobs.map((b) => discMean(fullDiff, b));
  const read = (frames: readonly Gray[], j: number) =>
    frames.reduce((code, frame, k) => {
      const lit = discMean(positiveDiff(frame, black), blobs[j]) > 0.5 * reference[j];
      return lit ? code | (1 << k) : code;
    }, 0);
  const byDot = new Map<number, number[]>();
  blobs.forEach((_, j) => {
    const col = read(colFrames, j) - 1;
    const row = read(rowFrames, j) - 1;
    if (col < 0 || col >= DOT_COLS || row < 0 || row >= DOT_ROWS) return;
    const dot = row * DOT_COLS + col;
    byDot.set(dot, [...(byDot.get(dot) ?? []), j]);
  });
  // Two blobs claiming the same dot are ambiguous: keep neither.
  return [...byDot].filter(([, js]) => js.length === 1).map(([dot, [blob]]) => ({ dot, blob }));
};

type Fit = { h: number[]; rms: number; matched: number };

const fitPairs = (
  blobs: readonly Blob[],
  dots: readonly Vec2[],
  pairs: ReadonlyArray<{ dot: number; blob: number }>,
): Fit | null => {
  const fit = refine(
    pairs.map((p) => [blobs[p.blob].x, blobs[p.blob].y] as Vec2),
    pairs.map((p) => dots[p.dot]),
  );
  return fit
    ? { h: fit.h, rms: reprojectionRms(fit.h, fit.cam, fit.screen), matched: fit.cam.length }
    : null;
};

/**
 * Matches blobs to dots by position, starting from the screen outline: seeds with the dots it
 * predicts closely, refits, re-predicts and repeats.
 */
const matchByProximity = (blobs: readonly Blob[], dots: readonly Vec2[], coarseInv: number[]) => {
  const predict = (inv: number[]) => dots.map(([u, v]) => applyHomography(inv, u, v) as Vec2);
  const first = predict(coarseInv);
  let spacing = Number.POSITIVE_INFINITY;
  for (let i = 0; i < first.length; i++) {
    for (let j = i + 1; j < first.length; j++) {
      spacing = Math.min(spacing, Math.hypot(first[i][0] - first[j][0], first[i][1] - first[j][1]));
    }
  }
  let best: Fit | null = null;
  let inv = coarseInv;
  let tolerance = matchDots(first, blobs, 0.2 * spacing).length >= 6 ? 0.2 : 0.45;
  for (let round = 0; round < 8; round++) {
    const matches = matchDots(predict(inv), blobs, tolerance * spacing);
    if (matches.length < 6) break;
    const fit = fitPairs(blobs, dots, matches);
    const fitInv = fit ? invert3(fit.h) : null;
    if (!fit || !fitInv) break;
    const improved = fit.matched > (best?.matched ?? 0);
    best = fit;
    inv = fitInv;
    tolerance = 0.3;
    if (!improved && round > 0) break;
  }
  return best;
};

export async function mapScreen(
  io: MappingIO,
  options: { viewportAspect: number; settleMs?: number },
): Promise<ScreenMapping | ScreenNotFoundError | MappingUnreliableError | MappingAbortedError> {
  const settleMs = options.settleMs ?? 900;
  const aborted = () => io.signal?.aborted === true;
  const show = async (pattern: Pattern, step: MappingStep) => {
    io.progress?.(step);
    await io.showPattern(pattern);
    await io.wait(settleMs);
    return io.capture(FRAMES_PER_PATTERN);
  };

  try {
    const black = await show({ kind: "black" }, "black");
    if (aborted()) return new MappingAbortedError();
    const white = await show({ kind: "white" }, "white");
    if (aborted()) return new MappingAbortedError();

    const screen = findScreenQuad(white, black);
    if (!screen) return new ScreenNotFoundError();
    const coarse = solveHomography(screen.corners, SCREEN_CORNERS);
    const coarseInv = coarse ? invert3(coarse) : null;
    if (!coarse || !coarseInv) return new ScreenNotFoundError();

    const dots = dotGrid();
    const dotsImage = await show({ kind: "dots", dots, radius: DOT_RADIUS }, "dots");
    if (aborted()) return new MappingAbortedError();

    const { width, height } = dotsImage;
    // Dot radius is relative to the viewport's short side → share of the screen area per dot.
    const aspect = options.viewportAspect;
    const dotAreaFraction = Math.PI * DOT_RADIUS ** 2 * Math.min(aspect, 1 / aspect);
    const expectedArea = Math.max(4, quadArea(screen.corners) * dotAreaFraction);
    const region = dilate(screen.mask, Math.round(0.015 * width));
    const blobs = findDots(dotsImage, black, region, expectedArea);

    // Identify every dot by its code instead of guessing from positions: the coarse outline can
    // be badly skewed when someone hides part of the screen, the codes are not affected.
    io.progress?.("coding");
    // Display (HDMI, mirroring) and camera add latency: give each coded frame time to show up.
    const codeSettle = Math.min(settleMs, 600);
    const showCode = async (axis: "col" | "row", bit: number) => {
      const subset = dots.filter((_, i) => {
        const index = axis === "col" ? i % DOT_COLS : Math.floor(i / DOT_COLS);
        return ((index + 1) >> bit) & 1;
      });
      await io.showPattern({ kind: "dots", dots: subset, radius: DOT_RADIUS });
      await io.wait(codeSettle);
      return io.capture(FRAMES_PER_CODE);
    };
    const colFrames: Gray[] = [];
    for (let bit = 0; bit < COL_BITS; bit++) colFrames.push(await showCode("col", bit));
    const rowFrames: Gray[] = [];
    for (let bit = 0; bit < ROW_BITS; bit++) rowFrames.push(await showCode("row", bit));
    if (aborted()) return new MappingAbortedError();
    io.progress?.("solving");

    const pairs = decodeDots(blobs, dotsImage, black, colFrames, rowFrames);
    const coded = pairs.length >= 6 ? fitPairs(blobs, dots, pairs) : null;
    let best = coded;
    let proximityMatched: number | null = null;
    // Codes misread (e.g. a frame captured before the screen changed): also try matching by
    // position from the screen outline, and keep whichever explains more dots.
    if (!coded || coded.matched < MIN_MATCHED_SHARE * dots.length) {
      const near = matchByProximity(blobs, dots, coarseInv);
      proximityMatched = near?.matched ?? 0;
      if (near && near.matched > (best?.matched ?? 0)) best = near;
    }
    const diagnostics: MappingDiagnostics = {
      screenShare: screen.area / (width * height),
      blobs: blobs.length,
      decoded: pairs.length,
      codedMatched: coded?.matched ?? 0,
      proximityMatched,
      rms: best?.rms ?? Number.NaN,
      method: !best ? "none" : best === coded ? "coded" : "proximity",
    };
    if (!best || best.matched < MIN_MATCHED_SHARE * dots.length || !(best.rms <= MAX_RMS)) {
      return new MappingUnreliableError(best?.matched ?? 0, dots.length, diagnostics);
    }
    const { h: homography, rms, matched } = best;
    const inv = invert3(homography) ?? coarseInv;
    return {
      homography,
      corners: SCREEN_CORNERS.map(([u, v]) => applyHomography(inv, u, v) as Vec2),
      cameraWidth: width,
      cameraHeight: height,
      matchedDots: matched,
      totalDots: dots.length,
      rms,
      diagnostics,
    };
  } finally {
    await io.showPattern(null);
  }
}
