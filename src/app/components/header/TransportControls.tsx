import { Loader2, Play, RotateCcw, Square } from "lucide-react";
import type { RefObject } from "react";
import { cn } from "../../lib/utils";

type TransportControlsProps = {
  isActive: boolean;
  isInitializing: boolean;
  transportTone: "light" | "dark";
  onRestart: () => void;
  onStart: () => void;
  onStop: () => void;
  transportButtonRef: RefObject<HTMLButtonElement>;
};

export const TransportControls = ({
  isActive,
  isInitializing,
  transportTone,
  onRestart,
  onStart,
  onStop,
  transportButtonRef,
}: TransportControlsProps) => {
  return (
    <>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-black/50 text-muted-foreground backdrop-blur transition hover:bg-black/70"
        aria-label="Restart pipeline"
        onClick={onRestart}
        disabled={isInitializing}
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition",
          isActive
            ? transportTone === "dark"
              ? "border-red-600/50 bg-white/85 text-red-700 hover:bg-white"
              : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            : transportTone === "dark"
              ? "border-emerald-600/50 bg-white/85 text-emerald-700 hover:bg-white"
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
