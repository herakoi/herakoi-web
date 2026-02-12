import { Loader2, Play, RotateCcw, Square } from "lucide-react";
import { type RefObject, useState } from "react";
import { cn } from "../../lib/utils";

type TransportControlsProps = {
  isActive: boolean;
  isInitializing: boolean;
  onRestart: () => void;
  onStart: () => void;
  onStop: () => void;
  transportButtonRef: RefObject<HTMLButtonElement>;
};

export const TransportControls = ({
  isActive,
  isInitializing,
  onRestart,
  onStart,
  onStop,
  transportButtonRef,
}: TransportControlsProps) => {
  const [restartActive, setRestartActive] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "border-border/50 bg-black/50 text-muted-foreground hover:bg-black/70 hover:text-foreground",
          restartActive && "border-white/40 bg-white/10 text-white",
        )}
        aria-label="Restart pipeline"
        onClick={onRestart}
        onPointerDown={() => setRestartActive(true)}
        onPointerUp={() => setRestartActive(false)}
        onPointerLeave={() => setRestartActive(false)}
        onBlur={() => setRestartActive(false)}
        disabled={isInitializing}
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isActive
            ? "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
        )}
        aria-label={isActive ? "Stop pipeline" : "Start pipeline"}
        onClick={isActive ? onStop : onStart}
        disabled={isInitializing}
        ref={transportButtonRef}
      >
        {isInitializing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <Square className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>
    </>
  );
};
