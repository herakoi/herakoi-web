import clsx from "clsx";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import { useWallStore } from "../store";
import styles from "./CalibrationOverlay.module.css";

/** Paints the mapping patterns full screen and tells the detector once each one is on screen. */
export const CalibrationOverlay = () => {
  const t = useT();
  const pattern = useWallStore((s) => s.pattern);
  const patternPainted = useWallStore((s) => s.patternPainted);

  useEffect(() => {
    if (!patternPainted) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => patternPainted());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [patternPainted]);

  if (!pattern || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={clsx(styles.overlay, pattern.kind === "white" && styles.white)}
      aria-hidden="true"
    >
      {pattern.kind === "countdown" ? (
        <div className={styles.countdown}>
          <span className={styles.seconds}>{pattern.seconds}</span>
          <span className={styles.message}>{t("countdown.stepAway")}</span>
        </div>
      ) : null}
      {pattern.kind === "dots"
        ? pattern.dots.map(([x, y]) => (
            <span
              key={`${x}-${y}`}
              className={styles.dot}
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: `${pattern.radius * 200}vmin`,
                height: `${pattern.radius * 200}vmin`,
              }}
            />
          ))
        : null}
    </div>,
    document.body,
  );
};
