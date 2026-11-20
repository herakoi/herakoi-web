import { createTaggedError } from "errore";

export class WallCameraStartError extends createTaggedError({
  name: "WallCameraStartError",
  message: "Camera start failed.",
}) {}

export class WallModelLoadError extends createTaggedError({
  name: "WallModelLoadError",
  message: "The tracking models could not be loaded.",
}) {}

export class WallNotRunningError extends createTaggedError({
  name: "WallNotRunningError",
  message: "Start the camera before mapping the screen.",
}) {}
