/**
 * Convert HSV bytes (0-255) to RGB color string
 */
export const hsvToRgb = (h: number, s: number, v: number): string => {
  // Normalize to 0-1 range
  const hNorm = (h / 255) * 360; // hue in degrees
  const sNorm = s / 255;
  const vNorm = v / 255;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hNorm >= 0 && hNorm < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hNorm >= 60 && hNorm < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hNorm >= 120 && hNorm < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hNorm >= 180 && hNorm < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hNorm >= 240 && hNorm < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (hNorm >= 300 && hNorm < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const rByte = Math.round((r + m) * 255);
  const gByte = Math.round((g + m) * 255);
  const bByte = Math.round((b + m) * 255);

  return `rgb(${rByte}, ${gByte}, ${bByte})`;
};
