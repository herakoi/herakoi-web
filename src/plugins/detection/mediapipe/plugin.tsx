import { Hand } from "lucide-react";
import type { DetectedPoint } from "#src/core/interfaces";
import type {
  DetectionPluginDefinition,
  PluginRuntimeContext,
  PluginTabMeta,
  PluginUISlots,
} from "#src/core/plugin";
import { defineDetectionPlugin } from "#src/core/plugin";
import { MediaPipeDockPanel } from "./components/DockPanel";
import { MediaPipeNotifications } from "./components/Notifications";
import { MediaPipeSettingsPanel } from "./components/SettingsPanel";
import { defaultMediaPipeConfig, type MediaPipeConfig, mediaPipeDetectionPluginId } from "./config";
import { useDeviceStore } from "./deviceStore";
import { bindDeviceSync } from "./deviceSync";
import { MediaPipeVideoNotMountedError } from "./errors";
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
  Notifications: MediaPipeNotifications,
};

export const plugin: DetectionPluginDefinition<typeof mediaPipeDetectionPluginId, MediaPipeConfig> =
  defineDetectionPlugin({
    id: mediaPipeDetectionPluginId,
    displayName: "MediaPipe Hands",
    settingsTab,
    ui,
    config: {
      defaultConfig: defaultMediaPipeConfig,
    },

    createDetector(config: MediaPipeConfig, runtime: PluginRuntimeContext<MediaPipeConfig>) {
      const videoEl = mediaPipeRefs.video?.current;

      if (!videoEl) {
        return new MediaPipeVideoNotMountedError();
      }

      // Read runtime state (not persisted)
      const {
        mirror: initialMirror,
        deviceId: selectedDeviceId,
        devices: knownDevices,
        setDeviceId,
      } = useDeviceStore.getState();

      // Guard against stale selections from previously unplugged cameras.
      // If selection is not known at startup, fall back to browser default camera.
      const initialDeviceId =
        selectedDeviceId && knownDevices.some((device) => device.deviceId === selectedDeviceId)
          ? selectedDeviceId
          : undefined;

      if (selectedDeviceId && !initialDeviceId) {
        setDeviceId(undefined);
      }

      const detector = new MediaPipePointDetector(videoEl, {
        maxHands: config.maxHands,
        mirrorX: initialMirror,
        deviceId: initialDeviceId,
        mediaPipeOptions: {
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        },
      });

      let unsubscribeConfig: (() => void) | null = null;
      let cleanupDeviceSync: (() => void) | null = null;
      const dispose = () => {
        unsubscribeConfig?.();
        cleanupDeviceSync?.();
        unsubscribeConfig = null;
        cleanupDeviceSync = null;
        useDeviceStore.getState().setHasHands(null);
        detector.stop();
      };

      const getSourceSize = () => {
        const width = videoEl.videoWidth;
        const height = videoEl.videoHeight;
        if (width <= 0 || height <= 0) return null;
        return { width, height };
      };

      return {
        detector,
        getSourceSize,
        setCanvasRefs: (refs) => {
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
                sourceSize?:
                  | { width: number; height: number }
                  | (() => { width: number; height: number } | null);
                fitMode?: "fill" | "contain" | "cover";
              }
          > = [];

          if (videoOverlay) {
            canvases.push({ canvas: videoOverlay, fitMode: "cover", sourceSize: getSourceSize });
          }

          if (imageOverlay) {
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
              fitMode: "cover",
              sourceSize: getSourceSize,
            });
          }

          if (canvases.length > 0) {
            bindHandsUi(detector, canvases);
          }

          cleanupDeviceSync = bindDeviceSync(detector);

          // Track hand presence for the Notifications component
          let lastHasHands: boolean | null = null;
          detector.onPointsDetected((points) => {
            const has = points.length > 0;
            if (has !== lastHasHands) {
              lastHasHands = has;
              useDeviceStore.getState().setHasHands(has);
            }
          });

          // Subscribe to config changes for runtime updates
          const prevConfig = { ...config };
          unsubscribeConfig = runtime.subscribeConfig((currentConfig) => {
            if (currentConfig.maxHands !== prevConfig.maxHands) {
              prevConfig.maxHands = currentConfig.maxHands;
              detector.setMaxHands(currentConfig.maxHands);
            }
          });
        },
        cleanup: () => {
          dispose();
        },
        [Symbol.dispose]: dispose,
      };
    },
  });
