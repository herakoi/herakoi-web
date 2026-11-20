/**
 * Storage for uploaded FITS files.
 *
 * Why: FITS files are often megabytes, past what localStorage holds, so the raw
 * bytes go to IndexedDB while the library entry (with a small thumbnail) stays in
 * the localStorage upload cache like any other upload.
 * What: save/load/delete raw files by image id, plus an in-memory cache of the
 * parsed cube so changing the layer mapping does not parse the file again.
 */

import type { LayerCube } from "./cube";
import { maybeGunzip, parseFits } from "./fits";

const DB_NAME = "herakoi-fits";
const STORE = "files";

/** Prefix of `ImageEntry.src` for FITS uploads; the rest is the image id. */
export const FITS_SRC_PREFIX = "fits:";

export const fitsSrcFor = (id: string) => `${FITS_SRC_PREFIX}${id}`;

export const fitsIdFromSrc = (src: string): string | null =>
  src.startsWith(FITS_SRC_PREFIX) ? src.slice(FITS_SRC_PREFIX.length) : null;

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB aborted."));
    });
  } finally {
    db.close();
  }
};

export const saveFitsFile = async (id: string, data: Blob) => {
  await withStore("readwrite", (store) => store.put(data, id));
};

export const deleteFitsFile = async (id: string) => {
  cubeCache.delete(id);
  await withStore("readwrite", (store) => store.delete(id));
};

const cubeCache = new Map<string, LayerCube>();
const CUBE_CACHE_LIMIT = 2;

export const cacheFitsCube = (id: string, cube: LayerCube) => {
  cubeCache.delete(id);
  cubeCache.set(id, cube);
  while (cubeCache.size > CUBE_CACHE_LIMIT) {
    const oldest = cubeCache.keys().next().value;
    if (oldest === undefined) break;
    cubeCache.delete(oldest);
  }
};

/** Read raw bytes (gzip or not) and parse them. */
export const parseFitsBlob = async (blob: Blob): Promise<LayerCube> =>
  parseFits(await maybeGunzip(await blob.arrayBuffer()));

/** The parsed cube for an image id, from memory or IndexedDB. */
export const loadFitsCube = async (id: string): Promise<LayerCube> => {
  const cached = cubeCache.get(id);
  if (cached) return cached;
  const blob = await withStore<Blob | undefined>("readonly", (store) => store.get(id));
  if (!blob) {
    throw new Error("The FITS file is no longer stored in this browser. Upload it again.");
  }
  const cube = await parseFitsBlob(blob);
  cacheFitsCube(id, cube);
  return cube;
};
