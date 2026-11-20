/**
 * Distance from blank pixels to the nearest pixel with data.
 *
 * Why: where a layer has no data (NaN), a sonifier can tell the listener how close the
 * nearest data is (e.g. beeping faster when approaching a source).
 * What: distanceToData() returns, for every pixel, the Euclidean distance to the nearest
 * finite pixel as a fraction of the image's longer side (0 on data pixels).
 * How: the exact squared Euclidean distance transform of Felzenszwalb & Huttenlocher,
 * run over columns and then rows; linear in the number of pixels.
 */

/** Squared distance transform of one line: `f` in, result written to `d`. */
const transformLine = (
  f: Float64Array,
  n: number,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array,
) => {
  let k = 0;
  v[0] = 0;
  z[0] = Number.NEGATIVE_INFINITY;
  z[1] = Number.POSITIVE_INFINITY;
  for (let q = 1; q < n; q += 1) {
    if (f[q] === Number.POSITIVE_INFINITY) continue;
    if (f[v[k]] === Number.POSITIVE_INFINITY) {
      // No finite parabola yet: start over with this one.
      v[k] = q;
      continue;
    }
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k -= 1;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Number.POSITIVE_INFINITY;
  }
  if (f[v[0]] === Number.POSITIVE_INFINITY) {
    d.fill(Number.POSITIVE_INFINITY, 0, n);
    return;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const delta = q - v[k];
    d[q] = delta * delta + f[v[k]];
  }
};

/**
 * Distance to the nearest finite pixel, as a fraction of the longer image side.
 * Returns null when the layer has no blank pixels or no data at all.
 */
export const distanceToData = (
  data: Float32Array,
  width: number,
  height: number,
): Float32Array | null => {
  let blanks = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (!Number.isFinite(data[i])) blanks += 1;
  }
  if (blanks === 0 || blanks === data.length) return null;

  const size = Math.max(width, height);
  const squared = new Float64Array(width * height);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);

  // Columns.
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      f[y] = Number.isFinite(data[y * width + x]) ? 0 : Number.POSITIVE_INFINITY;
    }
    transformLine(f, height, d, v, z);
    for (let y = 0; y < height; y += 1) squared[y * width + x] = d[y];
  }

  // Rows.
  const result = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) f[x] = squared[row + x];
    transformLine(f, width, d, v, z);
    for (let x = 0; x < width; x += 1) result[row + x] = Math.sqrt(d[x]) / size;
  }
  return result;
};
