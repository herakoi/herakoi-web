import type { ReactNode, RefObject } from "react";
import { useT } from "../i18n";
import styles from "./DockPanelPiPSurface.module.css";

type DockPanelPiPSurfaceProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  mirror: boolean;
  videoReady: boolean;
  aspectRatio: number;
  children: ReactNode;
};

export const DockPanelPiPSurface = ({
  videoRef,
  overlayRef,
  mirror,
  videoReady,
  aspectRatio,
  children,
}: DockPanelPiPSurfaceProps) => {
  const t = useT();
  return (
    <div className={styles.surface}>
      <div className={styles.frame} data-pip-surface style={{ aspectRatio }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label={t("camera.feed")}
          className={styles.video}
          style={mirror && videoReady ? { transform: "scaleX(-1)" } : undefined}
        />
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: Overlay canvas is decorative and not interactive */}
        <canvas ref={overlayRef} className={styles.overlay} aria-hidden="true" />
        {children}
      </div>
    </div>
  );
};
