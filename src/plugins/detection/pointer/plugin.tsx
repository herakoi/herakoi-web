import type {
  DetectionPluginDefinition,
  PluginRuntimeContext,
  PluginUISlots,
} from "#src/core/plugin";
import { defineDetectionPlugin } from "#src/core/plugin";
import { PointerSettingsPanel } from "./components/SettingsPanel";
import {
  defaultPointerDetectionConfig,
  type PointerDetectionConfig,
  pointerDetectionPluginId,
} from "./config";
import { PointerOverlayNotMountedError } from "./errors";
import { PointerPointDetector } from "./PointerPointDetector";
import { pointerDetectionRefs } from "./refs";
import { bindPointerUi } from "./uiPointer";

const ui: PluginUISlots<PointerDetectionConfig> = {
  SettingsPanel: PointerSettingsPanel,
};

export const plugin: DetectionPluginDefinition<
  typeof pointerDetectionPluginId,
  PointerDetectionConfig
> = defineDetectionPlugin({
  id: pointerDetectionPluginId,
  displayName: "Mouse / Touch",
  ui,
  config: {
    defaultConfig: defaultPointerDetectionConfig,
  },

  createDetector(
    _config: PointerDetectionConfig,
    _runtime: PluginRuntimeContext<PointerDetectionConfig>,
  ) {
    const detector = new PointerPointDetector(
      () => pointerDetectionRefs.imageOverlay?.current ?? null,
    );
    let clearOverlay = () => {};

    const dispose = () => {
      clearOverlay();
      detector.stop();
    };

    return {
      detector,
      setCanvasRefs: (refs) => {
        if (refs.imageOverlay) {
          pointerDetectionRefs.imageOverlay = refs.imageOverlay;
        }
      },
      getSourceSize: () => {
        const canvas = pointerDetectionRefs.imageOverlay?.current;
        if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
        return { width: canvas.width, height: canvas.height };
      },
      postInitialize: () => {
        const canvas = pointerDetectionRefs.imageOverlay?.current;
        if (!canvas) {
          throw new PointerOverlayNotMountedError();
        }
        clearOverlay = bindPointerUi(detector, canvas);
      },
      cleanup: () => {
        dispose();
      },
      [Symbol.dispose]: dispose,
    };
  },
});
