import { createTaggedError } from "errore";

export class ImageReadError extends createTaggedError({
  name: "ImageReadError",
  message: "Failed to read image file.",
}) {}

export class ImageDecodeError extends createTaggedError({
  name: "ImageDecodeError",
  message: "Failed to decode uploaded image.",
}) {}

export class ImageSelectError extends createTaggedError({
  name: "ImageSelectError",
  message: "Failed to select image.",
}) {}

export class UploadCacheReadError extends createTaggedError({
  name: "UploadCacheReadError",
  message: "Failed to parse upload cache.",
}) {}

export class UploadCacheWriteError extends createTaggedError({
  name: "UploadCacheWriteError",
  message: "Failed to persist upload cache.",
}) {}

export type ImageLibraryRuntimeError =
  | ImageReadError
  | ImageDecodeError
  | ImageSelectError
  | UploadCacheReadError
  | UploadCacheWriteError;
