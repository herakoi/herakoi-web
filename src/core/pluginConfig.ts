/**
 * Plugin configuration type registry and defaults.
 *
 * This file centralizes all plugin configuration types and their default values.
 * The framework manages storage and persistence, while plugins receive config
 * as props and remain stateless.
 */

// TODO: Generalizzare su plugin generici

// ──────────────────────────────────────────────────
// MediaPipe Detection Config
// ──────────────────────────────────────────────────

export type MediaPipeFacingMode = "user" | "environment";

export interface MediaPipeConfig {
  mirror: boolean;
  maxHands: number;
  facingMode: MediaPipeFacingMode;
}

export const defaultMediaPipeConfig: MediaPipeConfig = {
  mirror: true,
  maxHands: 2,
  facingMode: "user",
};

// ──────────────────────────────────────────────────
// HSV Sampling Config
// ──────────────────────────────────────────────────

export interface HSVSamplingConfig {
  imageCover: boolean;
  imagePan: { x: number; y: number };
  currentImageId: string | null;
}

export const defaultHSVSamplingConfig: HSVSamplingConfig = {
  imageCover: false,
  imagePan: { x: 0, y: 0 },
  currentImageId: null,
};

// ──────────────────────────────────────────────────
// Oscillator Sonification Config
// ──────────────────────────────────────────────────

export interface OscillatorConfig {
  minFreq: number;
  maxFreq: number;
  minVol: number;
  maxVol: number;
  oscillatorType: OscillatorType;
}

export const defaultOscillatorConfig: OscillatorConfig = {
  minFreq: 200,
  maxFreq: 700,
  minVol: 0,
  maxVol: 0.2,
  oscillatorType: "sine",
};

// ──────────────────────────────────────────────────
// Plugin Config Registry
// ──────────────────────────────────────────────────

/**
 * Type-safe registry mapping plugin IDs to their configuration types.
 *
 * When adding a new plugin:
 * 1. Define its config interface above
 * 2. Add it to this registry with its plugin ID as the key
 * 3. Add its default config to `pluginConfigDefaults` below
 */
export interface PluginConfigRegistry {
  "mediapipe-hands": MediaPipeConfig;
  "hsv-color": HSVSamplingConfig;
  oscillator: OscillatorConfig;
}

/**
 * Default configuration values for all plugins.
 *
 * Used by appConfigStore for initial state and resetAll().
 */
export const pluginConfigDefaults: PluginConfigRegistry = {
  "mediapipe-hands": defaultMediaPipeConfig,
  "hsv-color": defaultHSVSamplingConfig,
  oscillator: defaultOscillatorConfig,
};
