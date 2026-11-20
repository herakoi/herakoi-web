import { ScanLine } from "lucide-react";
import type {
  DetectionPluginDefinition,
  PluginRuntimeContext,
  PluginUISlots,
} from "#src/core/plugin";
import { defineDetectionPlugin } from "#src/core/plugin";
import { WallDockPanel } from "./components/DockPanel";
import { WallNotifications } from "./components/Notifications";
import { WallSettingsPanel } from "./components/SettingsPanel";
import { defaultWallConfig, type WallConfig, wallDetectionPluginId } from "./config";
import "./i18n";
import { wallRefs } from "./refs";
import { useWallStore } from "./store";
import { bindWallUi } from "./uiWall";
import { WallPointDetector } from "./WallPointDetector";

const ui: PluginUISlots<WallConfig> = {
  SettingsPanel: WallSettingsPanel,
  DockPanel: WallDockPanel,
  Notifications: WallNotifications,
};

export const plugin: DetectionPluginDefinition<typeof wallDetectionPluginId, WallConfig> =
  defineDetectionPlugin({
    id: wallDetectionPluginId,
    displayName: "Wall / Screen",
    icon: ScanLine,
    ui,
    config: {
      defaultConfig: defaultWallConfig,
    },

    createDetector(_config: WallConfig, runtime: PluginRuntimeContext<WallConfig>) {
      const detector = new WallPointDetector({
        getConfig: runtime.getConfig,
        setCalibration: (calibration) => runtime.setConfig({ calibration }),
        getOverlayCanvas: () => wallRefs.imageOverlay?.current ?? null,
      });

      let cleanupUi: (() => void) | null = null;
      let unsubscribeConfig: (() => void) | null = null;

      const runMapping = async () => {
        const store = useWallStore.getState();
        store.setMapping({ status: "running", step: "black" });
        const result = await detector.runMapping();
        useWallStore
          .getState()
          .setMapping(
            result instanceof Error ? { status: "error", error: result } : { status: "done" },
          );
      };

      const dispose = () => {
        unsubscribeConfig?.();
        cleanupUi?.();
        unsubscribeConfig = null;
        cleanupUi = null;
        const store = useWallStore.getState();
        store.setRunMapping(null);
        store.setHasHands(null);
        store.setPattern(null, null);
        detector.dispose();
      };

      if (import.meta.env.DEV) {
        (globalThis as Record<string, unknown>).__herakoiWall = { detector, store: useWallStore };
      }

      return {
        detector,
        setCanvasRefs: (refs) => {
          if (refs.imageOverlay) wallRefs.imageOverlay = refs.imageOverlay;
        },
        // Points are already normalised to the overlay canvas.
        getSourceSize: () => {
          const canvas = wallRefs.imageOverlay?.current;
          if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
          return { width: canvas.width, height: canvas.height };
        },
        postInitialize: () => {
          const canvas = wallRefs.imageOverlay?.current;
          if (canvas) cleanupUi = bindWallUi(detector, canvas);
          const store = useWallStore.getState();
          store.setRunMapping(runMapping);
          store.setHasHands(false);
          store.setMapped(runtime.getConfig().calibration !== null);

          let previous = runtime.getConfig();
          unsubscribeConfig = runtime.subscribeConfig((current) => {
            useWallStore.getState().setMapped(current.calibration !== null);
            if (current.maxPeople !== previous.maxPeople) {
              void detector.setMaxPeople(current.maxPeople);
            }
            if (current.deviceId !== previous.deviceId) {
              void detector.restartCamera(current.deviceId);
            }
            previous = current;
          });
        },
        cleanup: dispose,
        [Symbol.dispose]: dispose,
      };
    },
  });
