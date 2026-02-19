import { Hand, Pointer } from "lucide-react";
import type { DetectedPoint } from "#src/core/interfaces";
import type {
  DetectionPlugin,
  DetectorHandle,
  PluginTabMeta,
  PluginUISlots,
} from "#src/core/plugin";
import { useAppConfigStore } from "#src/state/appConfigStore";
import { MediaPipeDockPanel } from "./components/DockPanel";
import { MediaPipeSettingsPanel } from "./components/SettingsPanel";
import { defaultMediaPipeConfig, type MediaPipeConfig, mediaPipeDetectionPluginId } from "./config";
import { MediaPipePointDetector } from "./MediaPipePointDetector";
import type { HandOverlayStyle } from "./overlay";
import { mediaPipeRefs } from "./refs";
import { bindHandsUi } from "./uiHands";

const settingsTab: PluginTabMeta = {
  key: "input",
  label: "Input",
  icon: <Hand className="h-3.5 w-3.5" />,
};

const ui: PluginUISlots<MediaPipeConfig> = {
  SettingsPanel: MediaPipeSettingsPanel,
  DockPanel: MediaPipeDockPanel,
};

export const mediaPipeDetectionPlugin: DetectionPlugin<
  typeof mediaPipeDetectionPluginId,
  MediaPipeConfig
> = {
  kind: "detection",
  id: mediaPipeDetectionPluginId,
  displayName: "MediaPipe Hands",
  settingsTab,
  ui,
  config: {
    defaultConfig: defaultMediaPipeConfig,
  },

  createDetector(config: MediaPipeConfig): DetectorHandle {
    const videoEl = mediaPipeRefs.video?.current;

    if (!videoEl) {
      throw new Error(
        "MediaPipe detection plugin: video element not mounted. DockPanel must be rendered before pipeline starts.",
      );
    }

    const detector = new MediaPipePointDetector(videoEl, {
      maxHands: config.maxHands,
      mirrorX: config.mirror,
      facingMode: config.facingMode,
      mediaPipeOptions: {
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      },
    });

    return {
      detector,
      setCanvasRefs: (refs) => {
        // Register image overlay ref if provided
        if (refs.imageOverlay) {
          mediaPipeRefs.imageOverlay = refs.imageOverlay;
        }
      },
      postInitialize: () => {
        // Bind hand overlay drawing
        const videoOverlay = mediaPipeRefs.videoOverlay?.current;
        const imageOverlay = mediaPipeRefs.imageOverlay?.current;
        const canvases: Array<
          | HTMLCanvasElement
          | {
              canvas: HTMLCanvasElement;
              style?: HandOverlayStyle;
              getPointStyle?: (point: DetectedPoint) => HandOverlayStyle;
            }
        > = [];

        if (videoOverlay) {
          canvases.push(videoOverlay);
        }

        if (imageOverlay) {
          // Image overlay uses dynamic hue coloring
          const imageOverlayStyle: HandOverlayStyle = {
            connectorColor: "rgba(200, 200, 200, 0.85)",
            connectorWidth: 1.2,
            landmarkColor: "rgba(210, 210, 210, 0.95)",
            landmarkWidth: 1,
            focusColor: "rgba(215, 215, 215, 0.95)",
            focusFillColor: "rgba(210, 210, 210, 0.3)",
            focusWidth: 2,
            focusSize: 34,
            shadowColor: "rgba(210, 210, 210, 0.35)",
            shadowBlur: 8,
          };

          canvases.push({
            canvas: imageOverlay,
            style: imageOverlayStyle,
            // Note: getPointStyle with HSV hue sampling is currently omitted
            // to avoid circular dependency with the sampler. This can be
            // re-added in a future iteration when we have a proper way to
            // access the sampler from the plugin.
          });
        }

        if (canvases.length > 0) {
          bindHandsUi(detector, canvases);
        }

        // Subscribe to config changes for runtime updates
        const prevConfig = { ...config };
        useAppConfigStore.subscribe((state) => {
          const currentConfig = state.pluginConfigs[mediaPipeDetectionPluginId];

          if (currentConfig.mirror !== prevConfig.mirror) {
            prevConfig.mirror = currentConfig.mirror;
            detector.setMirror(currentConfig.mirror);
          }
          if (currentConfig.maxHands !== prevConfig.maxHands) {
            prevConfig.maxHands = currentConfig.maxHands;
            detector.setMaxHands(currentConfig.maxHands);
          }
          if (currentConfig.facingMode !== prevConfig.facingMode) {
            prevConfig.facingMode = currentConfig.facingMode;
            void detector.restartCamera(currentConfig.facingMode);
          }
        });
      },
      cleanup: () => {
        detector.stop();
      },
    };
  },

  bindPipelineEvents(detector, { showNotification, hideNotification }) {
    let lastDetected = false;

    detector.onPointsDetected((points) => {
      const hasHands = points.length > 0;
      if (hasHands !== lastDetected) {
        lastDetected = hasHands;
        if (hasHands) {
          hideNotification("mediapipe-hand-prompt");
        } else {
          showNotification("mediapipe-hand-prompt", {
            message: "Move your index finger in front of the camera to play",
            icon: Pointer,
          });
        }
      }
    });
  },
};
