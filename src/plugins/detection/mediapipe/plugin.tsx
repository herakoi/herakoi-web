import { Hand, Pointer } from "lucide-react";
import type { DetectedPoint } from "#src/core/interfaces";
import type {
  DetectionPluginDefinition,
  DetectorHandle,
  PluginRuntimeContext,
  PluginTabMeta,
  PluginUISlots,
} from "#src/core/plugin";
import { defineDetectionPlugin } from "#src/core/plugin";
import { MediaPipeDockPanel } from "./components/DockPanel";
import { MediaPipeSettingsPanel } from "./components/SettingsPanel";
import { defaultMediaPipeConfig, type MediaPipeConfig, mediaPipeDetectionPluginId } from "./config";
import { useDeviceStore } from "./deviceStore";
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

export const plugin: DetectionPluginDefinition<typeof mediaPipeDetectionPluginId, MediaPipeConfig> =
  defineDetectionPlugin({
    id: mediaPipeDetectionPluginId,
    displayName: "MediaPipe Hands",
    settingsTab,
    ui,
    config: {
      defaultConfig: defaultMediaPipeConfig,
    },

    createDetector(
      config: MediaPipeConfig,
      runtime: PluginRuntimeContext<MediaPipeConfig>,
    ): DetectorHandle {
      const videoEl = mediaPipeRefs.video?.current;

      if (!videoEl) {
        throw new Error(
          "MediaPipe detection plugin: video element not mounted. DockPanel must be rendered before pipeline starts.",
        );
      }

      const detector = new MediaPipePointDetector(videoEl, {
        maxHands: config.maxHands,
        mirrorX: config.mirror,
        deviceId: config.deviceId || undefined,
        mediaPipeOptions: {
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        },
      });
      let unsubscribeConfig: (() => void) | null = null;
      let deviceChangeHandler: (() => void) | null = null;

      const getSourceSize = () => {
        const width = videoEl.videoWidth;
        const height = videoEl.videoHeight;
        if (width <= 0 || height <= 0) return null;
        return { width, height };
      };

      const refreshDeviceList = async () => {
        const devices = await MediaPipePointDetector.enumerateDevices();
        useDeviceStore.getState().setDevices(devices);
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
                  | {
                      width: number;
                      height: number;
                    }
                  | (() => { width: number; height: number } | null);
                fitMode?: "fill" | "contain" | "cover";
              }
          > = [];

          if (videoOverlay) {
            canvases.push({
              canvas: videoOverlay,
              fitMode: "cover",
              sourceSize: getSourceSize,
            });
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

          // Expose restartCamera for UI (e.g. refresh button to retrigger permissions)
          const restartAndRefresh = async () => {
            const currentDeviceId = runtime.getConfig().deviceId;
            const facingMode = await detector.restartCamera(currentDeviceId || undefined);
            await refreshDeviceList();
            if (facingMode) {
              const shouldMirror = facingMode === "user";
              runtime.setConfig({ mirror: shouldMirror });
              detector.setMirror(shouldMirror);
            }
          };
          useDeviceStore.getState().setRestartCamera(restartAndRefresh);

          // Enumerate devices and auto-mirror based on active facing mode
          void refreshDeviceList().then(() => {
            const facingMode = detector.getActiveFacingMode();
            if (facingMode) {
              const shouldMirror = facingMode === "user";
              runtime.setConfig({ mirror: shouldMirror });
              detector.setMirror(shouldMirror);
            }
          });

          // Listen for device changes (plug/unplug cameras)
          deviceChangeHandler = () => void refreshDeviceList();
          navigator.mediaDevices?.addEventListener("devicechange", deviceChangeHandler);

          // Subscribe to config changes for runtime updates
          const prevConfig = { ...config };
          unsubscribeConfig = runtime.subscribeConfig((currentConfig) => {
            if (currentConfig.mirror !== prevConfig.mirror) {
              prevConfig.mirror = currentConfig.mirror;
              detector.setMirror(currentConfig.mirror);
            }
            if (currentConfig.maxHands !== prevConfig.maxHands) {
              prevConfig.maxHands = currentConfig.maxHands;
              detector.setMaxHands(currentConfig.maxHands);
            }
            if (currentConfig.deviceId !== prevConfig.deviceId) {
              prevConfig.deviceId = currentConfig.deviceId;
              void detector
                .restartCamera(currentConfig.deviceId || undefined)
                .then((facingMode) => {
                  if (facingMode) {
                    const shouldMirror = facingMode === "user";
                    runtime.setConfig({ mirror: shouldMirror });
                    detector.setMirror(shouldMirror);
                  }
                });
            }
          });
        },
        cleanup: () => {
          unsubscribeConfig?.();
          unsubscribeConfig = null;
          if (deviceChangeHandler) {
            navigator.mediaDevices?.removeEventListener("devicechange", deviceChangeHandler);
            deviceChangeHandler = null;
          }
          detector.stop();
          useDeviceStore.getState().setDevices([]);
          useDeviceStore.getState().setRestartCamera(null);
        },
      };
    },

    bindPipelineEvents(detector, { showNotification, hideNotification }) {
      let lastDetected: boolean | null = null;

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
  });
