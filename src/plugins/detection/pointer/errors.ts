import { createTaggedError } from "errore";

export class PointerOverlayNotMountedError extends createTaggedError({
  name: "PointerOverlayNotMountedError",
  message: "Pointer detection overlay canvas is not mounted.",
}) {}
