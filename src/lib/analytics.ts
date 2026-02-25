/**
 * Simple Analytics integration for privacy-friendly event tracking.
 *
 * Provides type-safe wrapper around Simple Analytics' global sa_event function
 * with environment-aware behavior:
 * - Development: Logs events to console only
 * - Production: Sends events to Simple Analytics dashboard
 *
 * Simple Analytics automatically detects the domain from the hostname,
 * no API key configuration needed.
 */

// Type augmentation for Simple Analytics global function
declare global {
  interface Window {
    /**
     * Simple Analytics event tracking function injected by the script.
     * Available after the Simple Analytics script loads.
     */
    sa_event?: (eventName: string, metadata?: Record<string, unknown>) => void;
  }
}

/**
 * Core event tracking function with environment-aware behavior.
 *
 * In development mode (import.meta.env.DEV), events are logged to console
 * instead of being sent to Simple Analytics. This prevents polluting
 * production analytics with development traffic.
 *
 * @param eventName - Kebab-case event identifier (e.g., "camera_started")
 * @param metadata - Optional key-value pairs providing event context
 *
 * @example
 * ```ts
 * trackEvent('image_uploaded', { source: 'drag_drop', fileSize: 1024 });
 * trackEvent('engine_error', { error: 'camera_permission_denied' });
 * ```
 */
export const trackEvent = (eventName: string, metadata?: Record<string, unknown>): void => {
  // Development mode: log to console for debugging
  if (import.meta.env.DEV) {
    console.log("[Analytics]", eventName, metadata ?? "");
    return;
  }

  // Production mode: send to Simple Analytics if script loaded
  if (typeof window !== "undefined" && window.sa_event) {
    window.sa_event(eventName, metadata);
  }
};

/**
 * Track camera/engine start event.
 * Indicates user activated the hand detection engine.
 */
export const trackCameraStart = (): void => {
  trackEvent("camera_started");
};

/**
 * Track camera/engine stop event.
 * Indicates user deactivated the hand detection engine.
 */
export const trackCameraStop = (): void => {
  trackEvent("camera_stopped");
};

/**
 * Track image upload from user's device.
 *
 * @param source - How the image was uploaded (e.g., 'file_picker', 'drag_drop')
 */
export const trackImageUpload = (source: string): void => {
  trackEvent("image_uploaded", { source });
};

/**
 * Track selection of a curated or pre-loaded image.
 *
 * @param imageId - Identifier of the selected image
 * @param collection - Which image collection it came from (e.g., 'curated', 'how_it_works')
 */
export const trackImageSelect = (imageId: string, collection?: string): void => {
  trackEvent("image_selected", { imageId, collection });
};

/**
 * Track engine error events.
 * Helps identify common failure modes and browser compatibility issues.
 *
 * @param error - Error message or code
 */
export const trackEngineError = (error: string): void => {
  trackEvent("engine_error", { error });
};

/**
 * Track engine restart action.
 * Indicates user clicked the restart button to reinitialize the engine.
 */
export const trackEngineRestart = (): void => {
  trackEvent("engine_restarted");
};

/**
 * Track image cover toggle.
 * Indicates user toggled between cover/contain image fit modes.
 *
 * @param enabled - Whether cover mode is now enabled
 */
export const trackImageCoverToggle = (enabled: boolean): void => {
  trackEvent("image_cover_toggled", { enabled });
};
