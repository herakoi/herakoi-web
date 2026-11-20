/**
 * Small, dependency-free image processing used by the screen mapping:
 * grey images as Float32Array luma (0–255), binary masks as Uint8Array (0/1).
 */

import type { Vec2 } from "./homography";

export type Gray = { data: Float32Array; width: number; height: number };
export type Mask = { data: Uint8Array; width: number; height: number };
export type Blob = { x: number; y: number; area: number };

/** Adds the luma of an RGBA buffer into `into` (for frame averaging). */
export const accumulateLuma = (rgba: Uint8ClampedArray, into: Float32Array): void => {
  for (let i = 0, p = 0; i < into.length; i++, p += 4) {
    into[i] += 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }
};

/** max(a − b, 0) per pixel. */
export const positiveDiff = (a: Gray, b: Gray): Gray => {
  const out = new Float32Array(a.data.length);
  for (let i = 0; i < out.length; i++) {
    const d = a.data[i] - b.data[i];
    out[i] = Math.max(d, 0);
  }
  return { data: out, width: a.width, height: a.height };
};

/** Otsu threshold over 0–255 values, optionally restricted to a region. */
export const otsuThreshold = (g: Gray, region?: Mask): number => {
  const hist = new Float64Array(256);
  let n = 0;
  for (let i = 0; i < g.data.length; i++) {
    if (region && !region.data[i]) continue;
    const v = Math.max(0, Math.min(255, Math.round(g.data[i])));
    hist[v]++;
    n++;
  }
  if (n === 0) return 128;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestT = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  return bestT + 0.5;
};

export const threshold = (g: Gray, t: number, region?: Mask): Mask => {
  const out = new Uint8Array(g.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = g.data[i] > t && (!region || region.data[i]) ? 1 : 0;
  }
  return { data: out, width: g.width, height: g.height };
};

/** Square dilation (grow) or erosion (shrink) with radius r, via separable running sums. */
const morph = (m: Mask, r: number, grow: boolean): Mask => {
  const { width: w, height: h } = m;
  const pass = (src: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(src.length);
    const outer = horizontal ? h : w;
    const inner = horizontal ? w : h;
    const idx = (o: number, i: number) => (horizontal ? o * w + i : i * w + o);
    for (let o = 0; o < outer; o++) {
      let count = 0;
      for (let i = 0; i < Math.min(r, inner); i++) count += src[idx(o, i)];
      for (let i = 0; i < inner; i++) {
        const add = i + r;
        const rem = i - r - 1;
        if (add < inner) count += src[idx(o, add)];
        if (rem >= 0) count -= src[idx(o, rem)];
        const span = Math.min(inner - 1, i + r) - Math.max(0, i - r) + 1;
        out[idx(o, i)] = grow ? (count > 0 ? 1 : 0) : count === span ? 1 : 0;
      }
    }
    return out;
  };
  return { data: pass(pass(m.data, true), false), width: w, height: h };
};

export const dilate = (m: Mask, r: number): Mask => (r > 0 ? morph(m, r, true) : m);
export const erode = (m: Mask, r: number): Mask => (r > 0 ? morph(m, r, false) : m);

/** 4-connected component labelling. Labels start at 1; 0 is background. */
export const labelComponents = (m: Mask): { labels: Int32Array; areas: number[] } => {
  const { width: w, height: h } = m;
  const labels = new Int32Array(m.data.length);
  const areas: number[] = [0];
  const stack = new Int32Array(m.data.length);
  let next = 1;
  for (let start = 0; start < m.data.length; start++) {
    if (!m.data[start] || labels[start]) continue;
    let top = 0;
    stack[top++] = start;
    labels[start] = next;
    let area = 0;
    while (top > 0) {
      const p = stack[--top];
      area++;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && m.data[p - 1] && !labels[p - 1]) {
        labels[p - 1] = next;
        stack[top++] = p - 1;
      }
      if (x < w - 1 && m.data[p + 1] && !labels[p + 1]) {
        labels[p + 1] = next;
        stack[top++] = p + 1;
      }
      if (y > 0 && m.data[p - w] && !labels[p - w]) {
        labels[p - w] = next;
        stack[top++] = p - w;
      }
      if (y < h - 1 && m.data[p + w] && !labels[p + w]) {
        labels[p + w] = next;
        stack[top++] = p + w;
      }
    }
    areas.push(area);
    next++;
  }
  return { labels, areas };
};

export const largestComponent = (m: Mask): { mask: Mask; area: number } | null => {
  const { labels, areas } = labelComponents(m);
  let best = 0;
  for (let l = 1; l < areas.length; l++) if (areas[l] > (areas[best] ?? 0)) best = l;
  if (best === 0) return null;
  const out = new Uint8Array(m.data.length);
  for (let i = 0; i < out.length; i++) out[i] = labels[i] === best ? 1 : 0;
  return { mask: { data: out, width: m.width, height: m.height }, area: areas[best] };
};

/** Pixels of the mask that touch the background (4-neighbourhood). */
export const boundaryPoints = (m: Mask): Vec2[] => {
  const { width: w, height: h, data } = m;
  const pts: Vec2[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!data[p]) continue;
      if (
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1 ||
        !data[p - 1] ||
        !data[p + 1] ||
        !data[p - w] ||
        !data[p + w]
      ) {
        pts.push([x, y]);
      }
    }
  }
  return pts;
};

/** Convex hull (Andrew's monotone chain), counter-clockwise in math axes. */
export const convexHull = (points: readonly Vec2[]): Vec2[] => {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
};

const quadArea = (q: readonly Vec2[]): number => {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i];
    const b = q[(i + 1) % q.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
};

/** Orders four corners as top-left, top-right, bottom-right, bottom-left (image axes). */
export const orderCorners = (pts: readonly Vec2[]): [Vec2, Vec2, Vec2, Vec2] => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  // Clockwise on screen (y down) = increasing atan2 angle.
  const sorted = [...pts].sort(
    (a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
  );
  let start = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] + sorted[i][1] < sorted[start][0] + sorted[start][1]) start = i;
  }
  const o = [0, 1, 2, 3].map((k) => sorted[(start + k) % 4]);
  return [o[0], o[1], o[2], o[3]];
};

/**
 * Largest-area quadrilateral with vertices on the hull: starts from the
 * extreme points and improves one corner at a time until stable.
 */
export const maxAreaQuad = (hull: readonly Vec2[]): Vec2[] => {
  if (hull.length <= 4) return [...hull];
  const pick = (score: (p: Vec2) => number) => {
    let best = 0;
    for (let i = 1; i < hull.length; i++) if (score(hull[i]) > score(hull[best])) best = i;
    return best;
  };
  const idx = [
    pick((p) => -(p[0] + p[1])),
    pick((p) => p[0] - p[1]),
    pick((p) => p[0] + p[1]),
    pick((p) => p[1] - p[0]),
  ];
  const quad = () => idx.map((i) => hull[i]);
  let area = quadArea(orderCorners(quad()));
  for (let iter = 0; iter < 20; iter++) {
    let improved = false;
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < hull.length; i++) {
        if (idx.includes(i)) continue;
        const keep = idx[k];
        idx[k] = i;
        const a = quadArea(orderCorners(quad()));
        if (a > area + 1e-6) {
          area = a;
          improved = true;
        } else {
          idx[k] = keep;
        }
      }
    }
    if (!improved) break;
  }
  return quad();
};

/** Intensity-weighted centroids of the connected blobs of `mask`, weighted by `weights`. */
export const blobCentroids = (mask: Mask, weights: Gray, minArea: number, maxArea: number) => {
  const { labels, areas } = labelComponents(mask);
  const sx = new Float64Array(areas.length);
  const sy = new Float64Array(areas.length);
  const sw = new Float64Array(areas.length);
  const w = mask.width;
  for (let p = 0; p < labels.length; p++) {
    const l = labels[p];
    if (!l) continue;
    const wt = weights.data[p] + 1e-3;
    sx[l] += (p % w) * wt;
    sy[l] += Math.floor(p / w) * wt;
    sw[l] += wt;
  }
  const blobs: Blob[] = [];
  for (let l = 1; l < areas.length; l++) {
    if (areas[l] < minArea || areas[l] > maxArea) continue;
    blobs.push({ x: sx[l] / sw[l], y: sy[l] / sw[l], area: areas[l] });
  }
  return blobs;
};
