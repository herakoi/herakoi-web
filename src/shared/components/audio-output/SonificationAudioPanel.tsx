import { ChevronUp, Volume2, VolumeX } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useMediaQuery } from "#src/shared/hooks/useMediaQuery";
import { cn } from "#src/shared/utils/cn";

/** Narrow or short viewports, where the open panel would crowd the canvas. */
const COMPACT_QUERY = "(max-width: 639px), (max-height: 480px)";

const asideClass =
  "pointer-events-auto flex w-12 flex-col items-center rounded-full border border-border/60 bg-black/55 text-card-foreground shadow-card backdrop-blur";

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
  const compact = useMediaQuery(COMPACT_QUERY);
  const [expanded, setExpanded] = useState(false);
  const controlsId = useId();

  if (!compact) {
    return (
      <aside
        className={cn(asideClass, "h-[248px] gap-3 py-3")}
        aria-label="Sonification audio controls"
      >
        {children}
      </aside>
    );
  }

  // Collapsed, the icon reports mute state; expanded, it offers to collapse.
  const ToggleIcon = expanded ? ChevronUp : muted ? VolumeX : Volume2;

  return (
    <aside
      className={cn(asideClass, "gap-1 p-1")}
      aria-label="Sonification audio controls"
      // Lets the shell rail switch layout while the controls are open.
      data-expanded={expanded || undefined}
    >
      <button
        type="button"
        aria-label="Volume controls"
        aria-expanded={expanded}
        aria-controls={controlsId}
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          expanded
            ? "bg-white/10 text-white"
            : "text-muted-foreground hover:bg-black/40 hover:text-foreground",
        )}
      >
        <ToggleIcon className="h-4 w-4" />
      </button>
      {/* Hidden rather than unmounted: the output selector keeps following device changes. */}
      <div
        id={controlsId}
        hidden={!expanded}
        className="flex h-[224px] flex-col items-center gap-3 pb-1 [@media(max-height:480px)]:h-[156px]"
      >
        {children}
      </div>
    </aside>
  );
};
