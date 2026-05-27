import { createTaggedError, TaggedError } from "errore";

export class CameraRestartError extends createTaggedError({
  name: "CameraRestartError",
  message: "Camera restart failed.",
}) {}

export class CameraStartError extends createTaggedError({
  name: "CameraStartError",
  message: "Camera start failed.",
}) {}

export class DeviceEnumerationError extends createTaggedError({
  name: "DeviceEnumerationError",
  message: "Unable to enumerate camera devices.",
}) {}

export class MediaPipeVideoNotMountedError extends createTaggedError({
  name: "MediaPipeVideoNotMountedError",
  message: "MediaPipe video element is not mounted.",
}) {}

/**
 * The OS (macOS TCC) blocks camera access. Unlike the wrappers above, this
 * carries the user-facing `message` directly (so it reaches the screen) plus an
 * `action` hint that lets the UI offer an "open system settings" affordance.
 */
export class CameraPermissionDeniedError extends TaggedError("CameraPermissionDeniedError")<{
  message: string;
  action: "open-camera-settings";
}>() {}

export type CameraRuntimeError =
  | CameraStartError
  | CameraRestartError
  | DeviceEnumerationError
  | CameraPermissionDeniedError;
