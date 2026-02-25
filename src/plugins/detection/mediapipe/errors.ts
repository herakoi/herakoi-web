import { createTaggedError } from "errore";

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

export type CameraRuntimeError = CameraStartError | CameraRestartError | DeviceEnumerationError;
