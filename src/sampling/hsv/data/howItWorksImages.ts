import type { ImageEntry } from "../types/image";

const gammaTestSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff0000" />
      <stop offset="16%" stop-color="#ffff00" />
      <stop offset="33%" stop-color="#00ff00" />
      <stop offset="50%" stop-color="#00ffff" />
      <stop offset="66%" stop-color="#0000ff" />
      <stop offset="83%" stop-color="#ff00ff" />
      <stop offset="100%" stop-color="#ff0000" />
    </linearGradient>
    <linearGradient id="sat" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="hsl(200, 0%, 50%)" />
      <stop offset="100%" stop-color="hsl(200, 100%, 50%)" />
    </linearGradient>
    <linearGradient id="val" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000000" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="#0b0b0b" />
  <rect x="80" y="80" width="1040" height="200" rx="24" fill="url(#hue)" />
  <rect x="80" y="320" width="1040" height="160" rx="24" fill="url(#sat)" />
  <rect x="80" y="520" width="1040" height="160" rx="24" fill="url(#val)" />
  <circle cx="200" cy="180" r="70" fill="#ffffff" />
  <circle cx="360" cy="180" r="70" fill="#00ffff" />
  <circle cx="520" cy="180" r="70" fill="#ff00ff" />
  <circle cx="680" cy="180" r="70" fill="#00ff00" />
  <circle cx="840" cy="180" r="70" fill="#ffcc00" />
  <circle cx="1000" cy="180" r="70" fill="#ff0000" />
</svg>
`.trim();

const gammaTestUrl = `data:image/svg+xml;utf8,${encodeURIComponent(gammaTestSvg)}`;

export const howItWorksImages: ImageEntry[] = [
  {
    id: "how-gamma-test",
    title: "Gamma color test",
    meta: "HSV sweep - SVG",
    src: gammaTestUrl,
    previewSrc: gammaTestUrl,
    kind: "how",
  },
];
