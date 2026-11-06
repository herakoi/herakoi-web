import { clsx } from "clsx";
import { ChevronUp, Volume2, VolumeX } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useMediaQuery } from "#src/shared/hooks/useMediaQuery";
import { useCommonT } from "#src/shared/i18n/common";
import styles from "./SonificationAudioPanel.module.css";

/** Narrow or short viewports, where the open panel would crowd the canvas. */
const COMPACT_QUERY = "(max-width: 639px), (max-height: 480px)";

type SonificationAudioPanelProps = {
  muted: boolean;
  /** Output selector and volume rail. */
  children: ReactNode;
};

/**
 * Rail holding a sonification plugin's audio controls.
 * On compact viewports it collapses to a volume button that expands in place.
 */
export const SonificationAudioPanel = ({ muted, children }: SonificationAudioPanelProps) => {
  const t = useCommonT();
  const compact = useMediaQuery(COMPACT_QUERY);
  const [expanded, setExpanded] = useState(false);
  const controlsId = useId();

  if (!compact) {
    return (
      <aside className={clsx(styles.panel, styles.full)} aria-label={t("volume.panel")}>
        {children}
      </aside>
    );
  }

  // Collapsed, the icon reports mute state; expanded, it offers to collapse.
  const ToggleIcon = expanded ? ChevronUp : muted ? VolumeX : Volume2;

  return (
    <aside
      className={clsx(styles.panel, styles.compact)}
      aria-label={t("volume.panel")}
      // Lets the shell rail switch layout while the controls are open.
      data-expanded={expanded || undefined}
    >
      <button
        type="button"
        aria-label={t("volume.controls")}
        aria-expanded={expanded}
        aria-controls={controlsId}
        onClick={() => setExpanded(!expanded)}
        className={clsx(styles.toggle, expanded ? styles.expanded : styles.collapsed)}
      >
        <ToggleIcon className={styles.icon} />
      </button>
      {/* Hidden rather than unmounted: the output selector keeps following device changes. */}
      <div id={controlsId} hidden={!expanded} className={styles.controls}>
        {children}
      </div>
    </aside>
  );
};
