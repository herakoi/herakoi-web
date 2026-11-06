import { clsx } from "clsx";
import { FlipHorizontal, Hand, MoveDiagonal2, X } from "lucide-react";
import type { KeyboardEvent, PointerEvent } from "react";
import { useT } from "../i18n";
import styles from "./DockPanelPiPActions.module.css";

type DockPanelPiPActionsProps = {
  mirror: boolean;
  maxHands: number;
  isResizing: boolean;
  onHide: () => void;
  onToggleMirror: () => void;
  onCycleMaxHands: () => void;
  onResizePointerDown: (event: PointerEvent<HTMLElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export const DockPanelPiPActions = ({
  mirror,
  maxHands,
  isResizing,
  onHide,
  onToggleMirror,
  onCycleMaxHands,
  onResizePointerDown,
  onResizeKeyDown,
}: DockPanelPiPActionsProps) => {
  const t = useT();
  return (
    <>
      <button
        type="button"
        aria-label={t("pip.close")}
        className={styles.close}
        onClick={(event) => {
          event.stopPropagation();
          onHide();
        }}
      >
        <X className={styles.icon} />
      </button>
      <button
        type="button"
        aria-label={mirror ? t("mirror.disable") : t("mirror.enable")}
        aria-pressed={mirror}
        className={clsx(styles.mirror, mirror && [styles.on, styles.mirrorOn])}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMirror();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <FlipHorizontal className={styles.icon} />
      </button>
      <button
        type="button"
        aria-label={t("hands.cycle")}
        className={styles.hands}
        onClick={(event) => {
          event.stopPropagation();
          onCycleMaxHands();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <Hand className={styles.icon} />
        <span className={styles.badge} aria-hidden="true">
          {maxHands}
        </span>
        <span className={styles.handsLabel}>{t("hands.max", { hands: maxHands })}</span>
      </button>
      <button
        type="button"
        aria-label={t("pip.resize")}
        className={clsx(styles.resize, isResizing && styles.on)}
        onPointerDown={(event) => {
          event.stopPropagation();
          onResizePointerDown(event);
        }}
        onKeyDown={onResizeKeyDown}
      >
        <MoveDiagonal2 className={styles.icon} />
      </button>
    </>
  );
};
