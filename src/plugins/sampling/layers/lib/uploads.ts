/**
 * Upload handling of the layers plugin: FITS files go to IndexedDB with a rendered
 * thumbnail; other files are read as ordinary images.
 */

import { isError, tryAsync } from "errore";
import { formatBytes } from "#src/shared/image/imageUtils";
import type { ImageEntry } from "#src/shared/image/types";
import { type ReadUpload, readImageUpload } from "#src/shared/image/useImageLibrary";
import { FitsParseError, FitsStorageError, LayerRenderError } from "../errors";
import { isFitsFileName } from "./fits";
import {
  cacheFitsCube,
  deleteFitsFile,
  fitsSrcFor,
  parseFitsBlob,
  saveFitsFile,
} from "./fitsStore";
import { defaultLayerMapping, renderThumbnail } from "./render";

/** `accept` value for upload inputs: images plus FITS (also gzip-compressed). */
export const layersFileAccept = "image/*,.fits,.fit,.fts,.gz";

const readFitsUpload: ReadUpload = async (file, id) => {
  const cube = await tryAsync({
    try: async () => parseFitsBlob(file),
    catch: (error) => new FitsParseError({ cause: error }),
  });
  if (isError(cube)) return cube;

  const stored = await tryAsync({
    try: async () => saveFitsFile(id, file),
    catch: (error) => new FitsStorageError({ cause: error }),
  });
  if (isError(stored)) return stored;
  cacheFitsCube(id, cube);

  const thumbnail = await tryAsync({
    try: async () => renderThumbnail(cube, defaultLayerMapping(cube.layers.length)),
    catch: (error) => new LayerRenderError({ cause: error }),
  });
  if (isError(thumbnail)) return thumbnail;

  const count = cube.layers.length;
  const layerText = count === 1 ? "1 layer" : `${count} layers`;
  return {
    id,
    title: file.name,
    meta: `${cube.sourceWidth}x${cube.sourceHeight} - ${layerText} - ${formatBytes(file.size)} - FITS`,
    src: fitsSrcFor(id),
    previewSrc: thumbnail,
    kind: "upload",
    addedAt: Date.now(),
    format: "fits",
    layers: cube.layers.map((layer) => layer.name),
  } satisfies ImageEntry;
};

export const readLayersUpload: ReadUpload = (file, id) =>
  isFitsFileName(file.name) ? readFitsUpload(file, id) : readImageUpload(file, id);

export const deleteLayersUpload = (entry: ImageEntry) => {
  if (entry.format !== "fits") return;
  void deleteFitsFile(entry.id).catch((error) => {
    console.error("Failed to delete stored FITS file.", error);
  });
};
