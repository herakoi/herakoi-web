import { clsx } from "clsx";
import { Loader2, Maximize, Minimize, Play, Square } from "lucide-react";
import type { RefObject } from "react";
import { useShellT } from "#src/i18n/shell";
import glass from "#src/shared/styles/glass.module.css";
import utilities from "#src/shared/styles/utilities.module.css";
import styles from "./Controls.module.css";

type ControlsProps = {
  isActive: boolean;
  isInitializing: boolean;
  onStart: () => void;
  onStop: () => void;
  isFullscreen: boolean;
  fullscreenAvailable: boolean;
  onToggleFullscreen: () => void;
  transportButtonRef: RefObject<HTMLButtonElement | null>;
};

export const Controls = ({
  isActive,
  isInitializing,
  onStart,
  onStop,
  isFullscreen,
  fullscreenAvailable,
  onToggleFullscreen,
  transportButtonRef,
}: ControlsProps) => {
  const t = useShellT();
  return (
    <>
      <button
        type="button"
        className={clsx(styles.fullscreen, glass.button, isFullscreen && glass.active)}
        aria-label={isFullscreen ? t("header.exitFullscreen") : t("header.enterFullscreen")}
        onClick={onToggleFullscreen}
        disabled={!fullscreenAvailable}
      >
        {isFullscreen ? <Minimize className={styles.icon} /> : <Maximize className={styles.icon} />}
      </button>
      <button
        type="button"
        className={clsx(styles.transport, isActive ? styles.stop : styles.start)}
        aria-label={isActive ? t("header.stopEngine") : t("header.startEngine")}
        onClick={isActive ? onStop : onStart}
        disabled={isInitializing}
        ref={transportButtonRef}
      >
        {isInitializing ? (
          <Loader2 className={clsx(styles.icon, utilities.spin)} />
        ) : isActive ? (
          <Square className={styles.icon} />
        ) : (
          <Play className={styles.icon} />
        )}
      </button>
    </>
  );
};
