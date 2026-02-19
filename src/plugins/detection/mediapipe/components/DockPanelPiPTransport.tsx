import { Loader2, Play, Square } from "lucide-react";

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
  return (
    <>
      {isRunning ? (
        <div className="pointer-events-none absolute inset-0 bg-black/35 opacity-0 transition group-hover:opacity-100" />
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        {!isActive ? (
          <button
            type="button"
            aria-label="Start pipeline"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 shadow-sm transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={(event) => {
              event.stopPropagation();
              onStart();
            }}
            disabled={isInitializing}
          >
            <Play className="h-5 w-5 translate-x-px" />
          </button>
        ) : isInitializing ? (
          <div className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-100 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <button
            type="button"
            aria-label="Stop pipeline"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-red-200 shadow-sm opacity-0 transition hover:bg-red-500/20 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={(event) => {
              event.stopPropagation();
              onStop();
            }}
            disabled={isInitializing}
          >
            <Square className="h-5 w-5" />
          </button>
        )}
      </div>
    </>
  );
};
