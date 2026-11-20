import { describe, expect, it } from "vitest";
import { isFitsFileName, maybeGunzip, parseFits } from "./fits";

const card = (text: string) => text.padEnd(80, " ").slice(0, 80);
const keyword = (key: string, value: string) => card(`${key.padEnd(8, " ")}= ${value}`);

const headerBytes = (cards: string[]) => {
  const text = [...cards, card("END")].join("");
  const padded = text.padEnd(Math.ceil(text.length / 2880) * 2880, " ");
  return new TextEncoder().encode(padded);
};

const dataBytes = (bitpix: number, values: number[]) => {
  const size = Math.abs(bitpix) / 8;
  const buffer = new ArrayBuffer(Math.ceil((values.length * size) / 2880) * 2880);
  const view = new DataView(buffer);
  values.forEach((value, index) => {
    const at = index * size;
    if (bitpix === -32) view.setFloat32(at, value, false);
    else if (bitpix === 16) view.setInt16(at, value, false);
  });
  return new Uint8Array(buffer);
};

const concat = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out.buffer;
};

describe("parseFits", () => {
  it("reads a 3D float cube as layers, top row first", () => {
    // 2x2 pixels, 2 planes. FITS rows go bottom to top.
    const values = [1, 2, 3, 4, 10, 20, 30, Number.NaN];
    const buffer = concat([
      headerBytes([
        keyword("SIMPLE", "T"),
        keyword("BITPIX", "-32"),
        keyword("NAXIS", "3"),
        keyword("NAXIS1", "2"),
        keyword("NAXIS2", "2"),
        keyword("NAXIS3", "2"),
        keyword("BUNIT", "'Jy/beam '"),
      ]),
      dataBytes(-32, values),
    ]);

    const cube = parseFits(buffer);

    expect(cube.width).toBe(2);
    expect(cube.height).toBe(2);
    expect(cube.layers.map((layer) => layer.name)).toEqual(["Primary [1]", "Primary [2]"]);
    expect(cube.layers[0].unit).toBe("Jy/beam");
    expect(Array.from(cube.layers[0].data)).toEqual([3, 4, 1, 2]);
    expect(cube.layers[1].data[0]).toBe(30);
    expect(Number.isNaN(cube.layers[1].data[1])).toBe(true);
  });

  it("collects image extensions, applies BSCALE/BZERO/BLANK and skips tables", () => {
    const buffer = concat([
      headerBytes([keyword("SIMPLE", "T"), keyword("BITPIX", "8"), keyword("NAXIS", "0")]),
      headerBytes([
        keyword("XTENSION", "'IMAGE   '"),
        keyword("BITPIX", "16"),
        keyword("NAXIS", "2"),
        keyword("NAXIS1", "2"),
        keyword("NAXIS2", "1"),
        keyword("BSCALE", "2.0"),
        keyword("BZERO", "1.0"),
        keyword("BLANK", "-1"),
        keyword("EXTNAME", "'VELOCITY'"),
      ]),
      dataBytes(16, [5, -1]),
      headerBytes([
        keyword("XTENSION", "'BINTABLE'"),
        keyword("BITPIX", "8"),
        keyword("NAXIS", "2"),
        keyword("NAXIS1", "4"),
        keyword("NAXIS2", "1"),
        keyword("PCOUNT", "0"),
        keyword("GCOUNT", "1"),
      ]),
      new Uint8Array(2880),
    ]);

    const cube = parseFits(buffer);

    expect(cube.layers).toHaveLength(1);
    expect(cube.layers[0].name).toBe("VELOCITY");
    expect(cube.layers[0].data[0]).toBe(11);
    expect(Number.isNaN(cube.layers[0].data[1])).toBe(true);
  });

  it("rejects files that are not FITS", () => {
    const buffer = new TextEncoder().encode("hello".padEnd(2880, " ")).buffer;
    expect(() => parseFits(buffer)).toThrow();
  });

  it("returns non-gzip bytes unchanged", async () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    await expect(maybeGunzip(buffer)).resolves.toBe(buffer);
  });

  it("recognises FITS file names", () => {
    expect(isFitsFileName("cube.fits")).toBe(true);
    expect(isFitsFileName("cube.FIT")).toBe(true);
    expect(isFitsFileName("cube.fits.gz")).toBe(true);
    expect(isFitsFileName("photo.png")).toBe(false);
  });
});
