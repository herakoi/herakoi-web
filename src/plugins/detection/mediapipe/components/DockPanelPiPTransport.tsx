import { clsx } from "clsx";
import { Loader2, Play, Square } from "lucide-react";
import utilities from "#src/shared/styles/utilities.module.css";
import { useT } from "../i18n";
import styles from "./DockPanelPiPTransport.module.css";

type DockPanelPiPTransportProps = {
  isRunning: boolean;
  isInitializing: boolean;
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
};

export const DockPanelPiPTransport = ({
  isRunning,
  isInitializing,
  isActive,
  onStart,
  onStop,
}: DockPanelPiPTransportProps) => {
  const t = useT();
  return (
    <>
      {isRunning ? <div className={styles.dimmer} /> : null}
      <div className={styles.center}>
        {!isActive ? (
          <button
            type="button"
            aria-label={t("engine.start")}
            className={styles.start}
            onClick={(event) => {
              event.stopPropagation();
              onStart();
            }}
            disabled={isInitializing}
          >
            <Play className={styles.playIcon} />
          </button>
        ) : isInitializing ? (
          <div className={styles.loading}>
            <Loader2 className={clsx(styles.icon, utilities.spin)} />
          </div>
        ) : (
          <button
            type="button"
            aria-label={t("engine.stop")}
            className={styles.stop}
            onClick={(event) => {
              event.stopPropagation();
              onStop();
            }}
            disabled={isInitializing}
          >
            <Square className={styles.icon} />
          </button>
        )}
      </div>
    </>
  );
};
