import { FlipHorizontal, Hand, Loader2, MoveDiagonal2, Play, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import type { FacingMode } from "../state/pipelineStore";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export type PiPState = { x: number; y: number; width: number };

type DragState = {
  mode: "move" | "resize";
  startX: number;
  startY: number;
  startPip: PiPState;
};

type PiPPanelProps = {
  open: boolean;
  onToggle: () => void;
  mirror: boolean;
  isRunning: boolean;
  isInitializing: boolean;
  onStart: () => void;
  onStop: () => void;
  onMirrorToggle: () => void;
  maxHands: number;
  onMaxHandsChange: (value: number) => void;
  facingMode: FacingMode;
  onFacingModeChange: (value: FacingMode) => void;
  pip: PiPState;
  setPip: React.Dispatch<React.SetStateAction<PiPState>>;
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
};

export const PiPPanel = ({
  open,
  onToggle,
  mirror,
  isRunning,
  isInitializing,
  onStart,
  onStop,
  onMirrorToggle,
  maxHands,
  onMaxHandsChange,
  facingMode,
  onFacingModeChange,
  pip,
  setPip,
  videoRef,
  overlayRef,
}: PiPPanelProps) => {
  const controlsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const isActive = isRunning || isInitializing;
  const [isResizing, setIsResizing] = useState(false);

  const getMaxPipY = useCallback((pipHeight: number) => {
    const controlsRect = controlsRef.current?.getBoundingClientRect();
    if (!controlsRect) {
      return window.innerHeight - pipHeight - 16;
    }
    return Math.max(8, controlsRect.top - pipHeight - 12);
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragRef.current) return;
      const { mode, startX, startY, startPip } = dragRef.current;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (mode === "move") {
        const height = (startPip.width * 9) / 16;
        const maxY = getMaxPipY(height);
        setPip({
          x: Math.max(4, Math.min(startPip.x + dx, window.innerWidth - startPip.width - 4)),
          y: Math.max(4, Math.min(startPip.y + dy, maxY)),
          width: startPip.width,
        });
      } else {
        const nextWidth = Math.max(180, Math.min(startPip.width + dx, window.innerWidth - 32));
        const height = (nextWidth * 9) / 16;
        const maxY = getMaxPipY(height);
        setPip({
          x: startPip.x,
          y: Math.max(4, Math.min(startPip.y, maxY)),
          width: nextWidth,
        });
      }
    },
    [getMaxPipY, setPip],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setIsResizing(false);
    window.removeEventListener("pointermove", onPointerMove);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (mode: "move" | "resize", event: React.PointerEvent<HTMLDivElement | HTMLButtonElement>) => {
      event.preventDefault();
      setIsResizing(mode === "resize");
      dragRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startPip: pip,
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, { once: true });
    },
    [onPointerMove, onPointerUp, pip],
  );

  useEffect(() => {
    setPip((prev) => {
      const height = (prev.width * 9) / 16;
      const nextY = getMaxPipY(height);
      return { ...prev, y: Math.max(8, nextY) };
    });
  }, [getMaxPipY, setPip]);

  useEffect(() => {
    const handleResize = () => {
      setPip((prev) => {
        const height = (prev.width * 9) / 16;
        const maxY = getMaxPipY(height);
        return {
          x: Math.max(8, Math.min(prev.x, window.innerWidth - prev.width - 8)),
          y: Math.max(8, Math.min(prev.y, maxY)),
          width: Math.min(prev.width, window.innerWidth - 32),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [getMaxPipY, setPip]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const markReady = () => setVideoReady(true);
    const markNotReady = () => setVideoReady(false);
    const updateState = () => {
      const hasStream = Boolean(video.srcObject);
      const isReady = hasStream && video.readyState >= 2 && !video.paused;
      setVideoReady(isReady);
    };
    updateState();
    video.addEventListener("playing", markReady);
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("pause", markNotReady);
    video.addEventListener("emptied", markNotReady);
    return () => {
      video.removeEventListener("playing", markReady);
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("pause", markNotReady);
      video.removeEventListener("emptied", markNotReady);
    };
  }, [videoRef]);

  return (
    <div className="fixed bottom-4 left-4 z-10 flex flex-col gap-2">
      <div ref={controlsRef} className="flex items-center gap-2">
        <Button
          variant="ghost"
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur border",
            open
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-border/50 bg-black/50 text-muted-foreground",
          )}
          aria-pressed={open}
          aria-label={open ? "Hide picture in picture" : "Show picture in picture"}
          onClick={onToggle}
        >
          Camera
        </Button>
        <Select
          value={facingMode}
          onValueChange={(value) => onFacingModeChange(value as FacingMode)}
        >
          <SelectTrigger
            aria-label="Camera facing"
            className="h-9 w-[150px] rounded-full border border-border/50 bg-black/50 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur focus:ring-1 focus:ring-ring/60 focus:ring-offset-0"
          >
            <SelectValue placeholder="Camera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Front</SelectItem>
            <SelectItem value="environment">Rear</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        className="overflow-hidden rounded-lg border border-border/70 bg-black/50 shadow-card backdrop-blur"
        style={{
          position: "fixed",
          left: pip.x,
          top: pip.y,
          width: pip.width,
          zIndex: 9,
          display: open ? "block" : "none",
        }}
      >
        <div className="group relative aspect-video select-none">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
            style={mirror && videoReady && isRunning ? { transform: "scaleX(-1)" } : undefined}
          />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          <div
            className="absolute inset-0 cursor-move"
            onPointerDown={(event) => onPointerDown("move", event)}
          />
          {isRunning ? (
            <div className="pointer-events-none absolute inset-0 bg-black/35 opacity-0 transition group-hover:opacity-100" />
          ) : null}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {!isActive ? (
              <button
                type="button"
                aria-label="Start pipeline"
                className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 shadow-sm transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-red-200 shadow-sm opacity-0 transition hover:bg-red-500/20 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
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
          <button
            type="button"
            aria-label="Hide picture-in-picture"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-black/55 text-white/80 transition hover:border-white/25 hover:bg-black/70"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={mirror ? "Disable mirror" : "Enable mirror"}
            aria-pressed={mirror}
            className={cn(
              "absolute left-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-transparent transition hover:border-white/25",
              mirror
                ? "bg-black/55 text-white/80 hover:bg-black/70"
                : "bg-white/85 text-black shadow-sm ring-1 ring-black/20 hover:bg-white/95",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onMirrorToggle();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <FlipHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Cycle max hands"
            className="absolute bottom-2 left-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-transparent bg-black/55 text-white/80 transition hover:border-white/25 hover:bg-black/70"
            onClick={(event) => {
              event.stopPropagation();
              const nextHands = maxHands >= 4 ? 1 : maxHands + 1;
              onMaxHandsChange(nextHands);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <Hand className="h-3.5 w-3.5" />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[9px] font-semibold text-black">
              {maxHands}
            </span>
          </button>
          <button
            type="button"
            aria-label="Resize picture-in-picture"
            className={cn(
              "absolute bottom-2 right-2 flex h-7 w-7 cursor-se-resize items-center justify-center rounded-full border border-transparent bg-black/55 text-white/80 transition hover:border-white/25 hover:bg-black/70",
              isResizing &&
                "bg-white/85 text-black ring-1 ring-black/20 hover:bg-white/85 hover:text-black",
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              onPointerDown("resize", event);
            }}
          >
            <MoveDiagonal2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
