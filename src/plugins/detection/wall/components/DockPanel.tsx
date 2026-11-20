import { EyeOff, ScanLine } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { DockPanelProps } from "#src/core/plugin";
import { Floating } from "#src/shared/components/Floating";
import { Button } from "#src/shared/components/ui/button";
import type { WallConfig } from "../config";
import { useT } from "../i18n";
import { useWallStore } from "../store";
import { CalibrationOverlay } from "./CalibrationOverlay";
import styles from "./DockPanel.module.css";
import { useStartMapping } from "./useStartMapping";

export const WallDockPanel = ({ config, setConfig }: DockPanelProps<WallConfig>) => {
  const t = useT();
  const { start, disabled } = useStartMapping();
  const initial = useMemo(
    () => ({ x: 16, y: typeof window === "undefined" ? 10_000 : window.innerHeight, width: 320 }),
    [],
  );
  const previewRef = useCallback((canvas: HTMLCanvasElement | null) => {
    useWallStore.getState().setPreviewCanvas(canvas);
  }, []);

  return (
    <>
      <CalibrationOverlay />
      <Floating
        open={config.showPreview}
        initial={initial}
        aspectRatio={16 / 9}
        minWidth={200}
        padding={4}
        moveHandleAriaLabel={t("preview.move")}
      >
        {({ onMovePointerDown, onMoveKeyDown, onResizePointerDown, onResizeKeyDown }) => (
          <div className={styles.surface}>
            <canvas
              ref={previewRef}
              className={styles.preview}
              role="img"
              aria-label={t("preview.title")}
            />
            <button
              type="button"
              aria-label={t("preview.move")}
              className={styles.moveHandle}
              onPointerDown={onMovePointerDown}
              onKeyDown={onMoveKeyDown}
            />
            <button
              type="button"
              aria-label={t("preview.resize")}
              className={styles.resize}
              onPointerDown={onResizePointerDown}
              onKeyDown={onResizeKeyDown}
            />
            <div className={styles.actions}>
              <Button size="sm" onClick={start} disabled={disabled}>
                <ScanLine className={styles.icon} />
                {config.calibration ? t("map.again") : t("map.start")}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("preview.hide")}
                onClick={() => setConfig({ showPreview: false })}
              >
                <EyeOff className={styles.icon} />
              </Button>
            </div>
          </div>
        )}
      </Floating>
    </>
  );
};
