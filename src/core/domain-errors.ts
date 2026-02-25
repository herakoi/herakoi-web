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
  message: "Engine plugin creation failed.",
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

export type EngineRuntimeError =
  | EngineCanvasNotReadyError
  | InvalidPluginConfigurationError
  | PluginCreationError
  | SamplingPostInitializeError
  | DetectionInitializeError
  | SonifierInitializeError
  | DetectionStartError
  | DetectionPostInitializeError
  | SonificationFrameProcessingError;
