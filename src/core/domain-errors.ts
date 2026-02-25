import { createTaggedError } from "errore";

export class EngineCanvasNotReadyError extends createTaggedError({
  name: "EngineCanvasNotReadyError",
  message: "Image canvas not mounted.",
}) {}

export class InvalidPluginConfigurationError extends createTaggedError({
  name: "InvalidPluginConfigurationError",
  message: "Invalid active plugin configuration.",
}) {}

export class PluginCreationError extends createTaggedError({
  name: "PluginCreationError",
  message: "Pipeline plugin creation failed.",
}) {}

export class SamplingPostInitializeError extends createTaggedError({
  name: "SamplingPostInitializeError",
  message: "Sampling plugin post-initialize failed.",
}) {}

export class DetectionInitializeError extends createTaggedError({
  name: "DetectionInitializeError",
  message: "Detector initialization failed.",
}) {}

export class SonifierInitializeError extends createTaggedError({
  name: "SonifierInitializeError",
  message: "Sonifier initialization failed.",
}) {}

export class DetectionStartError extends createTaggedError({
  name: "DetectionStartError",
  message: "Detector start failed.",
}) {}

export class DetectionPostInitializeError extends createTaggedError({
  name: "DetectionPostInitializeError",
  message: "Detector post-initialize failed.",
}) {}

export class SonificationFrameProcessingError extends createTaggedError({
  name: "SonificationFrameProcessingError",
  message: "Sonification frame processing failed.",
}) {}

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

export type CameraRuntimeError = CameraStartError | CameraRestartError | DeviceEnumerationError;

export type ImageLibraryRuntimeError =
  | ImageReadError
  | ImageDecodeError
  | ImageSelectError
  | UploadCacheReadError
  | UploadCacheWriteError;

export type PipelineRuntimeError =
  | EngineCanvasNotReadyError
  | InvalidPluginConfigurationError
  | PluginCreationError
  | SamplingPostInitializeError
  | DetectionInitializeError
  | SonifierInitializeError
  | DetectionStartError
  | DetectionPostInitializeError
  | SonificationFrameProcessingError;
