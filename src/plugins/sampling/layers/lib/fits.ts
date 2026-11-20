/**
 * Minimal FITS reader for multi-layer images.
 *
 * Why: astronomers keep layered data (RGB + extra maps, moment maps, cubes) in FITS,
 * and the browser has no decoder for it. The format is simple enough that a small
 * own parser beats a dependency.
 * What: parseFits() walks every HDU, keeps the image HDUs (primary and IMAGE
 * extensions) and turns each 2D plane into a Float32 layer of the same size.
 * How: headers are 2880-byte blocks of 80-character cards; data is big-endian and
 * padded to 2880 bytes. Planes are decimated to fit a memory budget and flipped so
 * row 0 is the top of the image, as on screen (FITS stores the bottom row first).
 */

import { decimationStride, type Layer, type LayerCube, MAX_LAYERS } from "./cube";

const BLOCK = 2880;
const CARD = 80;

type HeaderValue = string | number | boolean;

type Header = Map<string, HeaderValue>;

const parseCardValue = (raw: string): HeaderValue | undefined => {
  const text = raw.trimStart();
  if (text.startsWith("'")) {
    // Strings are quoted; a doubled quote stands for one quote.
    let value = "";
    for (let i = 1; i < text.length; i += 1) {
      if (text[i] === "'") {
        if (text[i + 1] === "'") {
          value += "'";
          i += 1;
          continue;
        }
        break;
      }
      value += text[i];
    }
    return value.trimEnd();
  }
  const slash = text.indexOf("/");
  const token = (slash >= 0 ? text.slice(0, slash) : text).trim();
  if (token === "T") return true;
  if (token === "F") return false;
  if (token === "") return undefined;
  const number = Number(token.replace(/[dD]/, "E"));
  return Number.isFinite(number) ? number : token;
};

/** Read one header from `offset`; returns the header and where its data starts. */
const readHeader = (bytes: Uint8Array, offset: number): { header: Header; dataStart: number } => {
  const header: Header = new Map();
  const decoder = new TextDecoder("latin1");
  let position = offset;
  while (position + BLOCK <= bytes.length) {
    const block = decoder.decode(bytes.subarray(position, position + BLOCK));
    position += BLOCK;
    for (let i = 0; i < BLOCK; i += CARD) {
      const card = block.slice(i, i + CARD);
      const key = card.slice(0, 8).trim();
      if (key === "END") {
        return { header, dataStart: position };
      }
      if (card.slice(8, 10) !== "= ") continue;
      const value = parseCardValue(card.slice(10));
      if (value !== undefined && !header.has(key)) header.set(key, value);
    }
  }
  throw new Error("FITS header has no END card.");
};

const numberOf = (header: Header, key: string, fallback?: number): number => {
  const value = header.get(key);
  if (typeof value === "number") return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`FITS header is missing ${key}.`);
};

const stringOf = (header: Header, key: string): string | undefined => {
  const value = header.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

type ImageHdu = {
  index: number;
  header: Header;
  dataStart: number;
  bitpix: number;
  width: number;
  height: number;
  planes: number;
};

const findImageHdus = (bytes: Uint8Array): ImageHdu[] => {
  const hdus: ImageHdu[] = [];
  let offset = 0;
  let index = 0;
  while (offset + BLOCK <= bytes.length) {
    let parsed: { header: Header; dataStart: number };
    try {
      parsed = readHeader(bytes, offset);
    } catch (error) {
      // A broken first header means this is not FITS; later ones are trailing junk.
      if (index === 0) throw error;
      break;
    }
    const { header, dataStart } = parsed;
    if (index === 0 && header.get("SIMPLE") !== true) {
      throw new Error("Not a FITS file (SIMPLE = T missing).");
    }

    const bitpix = numberOf(header, "BITPIX");
    const naxis = numberOf(header, "NAXIS", 0);
    const axes = Array.from({ length: naxis }, (_, i) => numberOf(header, `NAXIS${i + 1}`));
    const pcount = numberOf(header, "PCOUNT", 0);
    const gcount = numberOf(header, "GCOUNT", 1);
    const elements = naxis === 0 ? 0 : axes.reduce((product, size) => product * size, 1);
    const dataSize = naxis === 0 ? 0 : (Math.abs(bitpix) / 8) * gcount * (pcount + elements);

    const xtension = stringOf(header, "XTENSION")?.toUpperCase();
    const isImage = index === 0 || xtension === "IMAGE" || xtension === "IUEIMAGE";
    if (isImage && naxis >= 2 && axes[0] > 0 && axes[1] > 0) {
      hdus.push({
        index,
        header,
        dataStart,
        bitpix,
        width: axes[0],
        height: axes[1],
        planes: axes.slice(2).reduce((product, size) => product * size, 1),
      });
    }

    offset = dataStart + Math.ceil(dataSize / BLOCK) * BLOCK;
    index += 1;
  }
  return hdus;
};

const valueReader = (view: DataView, bitpix: number): ((byteOffset: number) => number) => {
  switch (bitpix) {
    case 8:
      return (at) => view.getUint8(at);
    case 16:
      return (at) => view.getInt16(at, false);
    case 32:
      return (at) => view.getInt32(at, false);
    case 64:
      return (at) => Number(view.getBigInt64(at, false));
    case -32:
      return (at) => view.getFloat32(at, false);
    case -64:
      return (at) => view.getFloat64(at, false);
    default:
      throw new Error(`Unsupported FITS BITPIX ${bitpix}.`);
  }
};

const layerName = (hdu: ImageHdu, plane: number): string => {
  const base =
    stringOf(hdu.header, "EXTNAME") ?? (hdu.index === 0 ? "Primary" : `HDU ${hdu.index}`);
  return hdu.planes === 1 ? base : `${base} [${plane + 1}]`;
};

/** Parse FITS bytes into equally sized Float32 layers. */
export const parseFits = (buffer: ArrayBuffer): LayerCube => {
  const bytes = new Uint8Array(buffer);
  const hdus = findImageHdus(bytes);
  const first = hdus[0];
  if (!first) {
    throw new Error("FITS file holds no 2D image data.");
  }

  // Layers must share the first image's size; other images are left out.
  const matching = hdus.filter((hdu) => hdu.width === first.width && hdu.height === first.height);
  const layerCount = matching.reduce((count, hdu) => count + hdu.planes, 0);
  if (layerCount > MAX_LAYERS) {
    throw new Error(`FITS file has ${layerCount} layers; at most ${MAX_LAYERS} are supported.`);
  }

  const sourceWidth = first.width;
  const sourceHeight = first.height;
  const stride = decimationStride(sourceWidth, sourceHeight, layerCount);
  const width = Math.ceil(sourceWidth / stride);
  const height = Math.ceil(sourceHeight / stride);

  const view = new DataView(buffer);
  const layers: Layer[] = [];
  for (const hdu of matching) {
    const bytesPerValue = Math.abs(hdu.bitpix) / 8;
    const read = valueReader(view, hdu.bitpix);
    const bscale = numberOf(hdu.header, "BSCALE", 1);
    const bzero = numberOf(hdu.header, "BZERO", 0);
    const blankValue = hdu.header.get("BLANK");
    const blank = hdu.bitpix > 0 && typeof blankValue === "number" ? blankValue : undefined;
    const unit = stringOf(hdu.header, "BUNIT");
    const planeSize = sourceWidth * sourceHeight;
    const end = hdu.dataStart + planeSize * hdu.planes * bytesPerValue;
    if (end > bytes.length) {
      throw new Error("FITS file is truncated.");
    }

    for (let plane = 0; plane < hdu.planes; plane += 1) {
      const data = new Float32Array(width * height);
      for (let y = 0; y < height; y += 1) {
        const sourceRow = y * stride;
        // FITS row 0 is the bottom of the image.
        const targetRow = height - 1 - y;
        for (let x = 0; x < width; x += 1) {
          const sourceIndex = plane * planeSize + sourceRow * sourceWidth + x * stride;
          const raw = read(hdu.dataStart + sourceIndex * bytesPerValue);
          data[targetRow * width + x] = raw === blank ? Number.NaN : bzero + bscale * raw;
        }
      }
      layers.push({ name: layerName(hdu, plane), unit, data });
    }
  }

  return { width, height, sourceWidth, sourceHeight, layers };
};

const isGzip = (bytes: Uint8Array) => bytes[0] === 0x1f && bytes[1] === 0x8b;

/** Unpack gzip-compressed FITS (`.fits.gz`); other bytes are returned unchanged. */
export const maybeGunzip = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (!isGzip(new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength)))) return buffer;
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot unpack .gz files.");
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
};

/** Whether a file name looks like FITS (optionally gzip-compressed). */
export const isFitsFileName = (name: string) => /\.(fits?|fts)(\.gz)?$/i.test(name);
