/**
 * Planar homography helpers (3×3, row-major, h[8] normalised to 1).
 *
 * Used to map camera pixels onto the screen (normalised 0–1 viewport space)
 * and back. Solved with a normalised DLT: points are centred and scaled
 * before building the least-squares system, which keeps it well conditioned
 * for any number of correspondences ≥ 4.
 */

export type Vec2 = readonly [number, number];
export type Mat3 = readonly number[];

export const applyHomography = (h: Mat3, x: number, y: number): [number, number] => {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
};

export const multiply3 = (a: Mat3, b: Mat3): number[] => {
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
};

export const invert3 = (m: Mat3): number[] | null => {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const inv = [
    A,
    -(b * i - c * h),
    b * f - c * e,
    B,
    a * i - c * g,
    -(a * f - c * d),
    C,
    -(a * h - b * g),
    a * e - b * d,
  ].map((v) => v / det);
  return normalise(inv);
};

const normalise = (h: number[]): number[] => {
  const s = Math.abs(h[8]) > 1e-12 ? h[8] : 1;
  return h.map((v) => v / s);
};

/** Similarity transform that centres points on the origin with mean distance √2. */
const conditioner = (pts: readonly Vec2[]): number[] => {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  cx /= pts.length;
  cy /= pts.length;
  let mean = 0;
  for (const [x, y] of pts) mean += Math.hypot(x - cx, y - cy);
  mean /= pts.length;
  const s = mean > 1e-12 ? Math.SQRT2 / mean : 1;
  return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1];
};

/** Solve A·x = b (n×n, row-major) with partial pivoting. Returns null if singular. */
const solveLinear = (A: number[], b: number[], n: number): number[] | null => {
  const M = A.slice();
  const v = b.slice();
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r * n + col]) > Math.abs(M[pivot * n + col])) pivot = r;
    }
    if (Math.abs(M[pivot * n + col]) < 1e-12) return null;
    if (pivot !== col) {
      for (let c = 0; c < n; c++) {
        const t = M[col * n + c];
        M[col * n + c] = M[pivot * n + c];
        M[pivot * n + c] = t;
      }
      const t = v[col];
      v[col] = v[pivot];
      v[pivot] = t;
    }
    for (let r = col + 1; r < n; r++) {
      const f = M[r * n + col] / M[col * n + col];
      if (f === 0) continue;
      for (let c = col; c < n; c++) M[r * n + c] -= f * M[col * n + c];
      v[r] -= f * v[col];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = v[r];
    for (let c = r + 1; c < n; c++) s -= M[r * n + c] * x[c];
    x[r] = s / M[r * n + r];
  }
  return x;
};

/**
 * Homography mapping `src[i]` → `dst[i]` (least squares when more than 4 pairs).
 * Returns null for degenerate input (collinear points, mismatched lengths).
 */
export const solveHomography = (src: readonly Vec2[], dst: readonly Vec2[]): number[] | null => {
  if (src.length < 4 || src.length !== dst.length) return null;
  const Ts = conditioner(src);
  const Td = conditioner(dst);
  const AtA = new Array<number>(64).fill(0);
  const Atb = new Array<number>(8).fill(0);
  const accumulate = (row: number[], rhs: number) => {
    for (let i = 0; i < 8; i++) {
      if (row[i] === 0) continue;
      Atb[i] += row[i] * rhs;
      for (let j = 0; j < 8; j++) AtA[i * 8 + j] += row[i] * row[j];
    }
  };
  for (let k = 0; k < src.length; k++) {
    const [x, y] = applyHomography(Ts, src[k][0], src[k][1]);
    const [u, v] = applyHomography(Td, dst[k][0], dst[k][1]);
    accumulate([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    accumulate([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  const h = solveLinear(AtA, Atb, 8);
  if (!h || h.some((v) => !Number.isFinite(v))) return null;
  const TdInv = invert3(Td);
  if (!TdInv) return null;
  return normalise(multiply3(multiply3(TdInv, [...h, 1]), Ts));
};

/** Root-mean-square distance between H·src and dst. */
export const reprojectionRms = (h: Mat3, src: readonly Vec2[], dst: readonly Vec2[]): number => {
  if (src.length === 0) return 0;
  let sum = 0;
  for (let k = 0; k < src.length; k++) {
    const [u, v] = applyHomography(h, src[k][0], src[k][1]);
    sum += (u - dst[k][0]) ** 2 + (v - dst[k][1]) ** 2;
  }
  return Math.sqrt(sum / src.length);
};
