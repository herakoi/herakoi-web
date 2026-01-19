import { Loader2, Play, RotateCcw, Square } from "lucide-react";
import { type RefObject, useState } from "react";
import { cn } from "../../lib/utils";

type TransportControlsProps = {
  isActive: boolean;
  isInitializing: boolean;
  transportTone: "light" | "dark";
  restartTone: "light" | "dark";
  onRestart: () => void;
  onStart: () => void;
  onStop: () => void;
  transportButtonRef: RefObject<HTMLButtonElement>;
  restartButtonRef: RefObject<HTMLButtonElement>;
};

export const TransportControls = ({
  isActive,
  isInitializing,
  transportTone,
  restartTone,
  onRestart,
  onStart,
  onStop,
  transportButtonRef,
  restartButtonRef,
}: TransportControlsProps) => {
  const [restartActive, setRestartActive] = useState(false);
  const restartBaseClass =
    restartTone === "dark"
      ? "border-black/30 bg-black/40 text-white/90"
      : "border-border/50 bg-black/50 text-muted-foreground";
  const restartHoverClass =
    restartTone === "dark"
      ? "hover:bg-black/55 hover:text-white"
      : "hover:bg-black/70 hover:text-foreground";
  const restartActiveClass =
    restartTone === "dark"
      ? "border-black/50 bg-black/70 text-white"
      : "border-white/40 bg-white/10 text-white";

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition",
          restartBaseClass,
          restartHoverClass,
          restartActive && restartActiveClass,
        )}
        aria-label="Restart pipeline"
        onClick={onRestart}
        onPointerDown={() => setRestartActive(true)}
        onPointerUp={() => setRestartActive(false)}
        onPointerLeave={() => setRestartActive(false)}
        onBlur={() => setRestartActive(false)}
        disabled={isInitializing}
        ref={restartButtonRef}
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition",
          isActive
            ? transportTone === "dark"
              ? "border-red-500/50 bg-black/40 text-red-200 hover:bg-black/55"
              : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            : transportTone === "dark"
              ? "border-emerald-500/50 bg-black/40 text-emerald-200 hover:bg-black/55"
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
