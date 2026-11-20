import { createTaggedError } from "errore";

export class FitsParseError extends createTaggedError({
  name: "FitsParseError",
  message: "Failed to read FITS file.",
}) {}

export class FitsStorageError extends createTaggedError({
  name: "FitsStorageError",
  message: "Failed to store FITS file in this browser.",
}) {}

export class LayerRenderError extends createTaggedError({
  name: "LayerRenderError",
  message: "Failed to render the image layers.",
}) {}
