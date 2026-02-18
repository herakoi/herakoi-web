import {
  Camera,
  FlipHorizontal,
  Hand,
  Loader2,
  MoveDiagonal2,
  Play,
  Square,
  X,
} from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "#src/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/app/components/ui/select";
import { useIdleDimmer } from "#src/app/hooks/useIdleDimmer";
import { cn } from "#src/app/lib/utils";
import type { DockPanelProps } from "#src/core/plugin";
import type { MediaPipeConfig } from "#src/core/pluginConfig";
import { registerOverlayRef, registerVideoRef } from "../refs";
import { useMediaPipeRuntimeStore } from "../runtimeStore";

type PiPState = { x: number; y: number; width: number };

type DragState = {
  mode: "move" | "resize";
  startX: number;
  startY: number;
  startPip: PiPState;
};

export const MediaPipeDockPanel = ({
  isRunning,
  isInitializing,
  onStart,
  onStop,
  setUiOpacity,
  config,
  setConfig,
  baseUiOpacity,
}: DockPanelProps<MediaPipeConfig>) => {
  const { mirror, maxHands, facingMode } = config;

  // Read runtime state
  const handDetected = useMediaPipeRuntimeStore((state) => state.handDetected);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [pip, setPip] = useState<PiPState>({
    x: 16,
    y: 16,
    width: 260,
  });
  const [pipOpen, setPipOpen] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const isActive = isRunning || isInitializing;

  // Idle dimming: dim UI to 15% opacity after 5s of mouse idle when hands detected
  useIdleDimmer({
    active: handDetected,
    setUiOpacity,
    baseOpacity: baseUiOpacity,
    dimOpacity: 0.15,
  });

  // Register refs for plugin factory to access
  useEffect(() => {
    if (videoRef.current) {
      registerVideoRef(videoRef);
    }
    if (overlayRef.current) {
      registerOverlayRef("videoOverlay", overlayRef);
    }
  }, []);

  // Keep overlay canvas intrinsic dimensions in sync with its CSS size so
  // bindHandsUi draws at the correct resolution instead of the 300×150 default.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

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
    [getMaxPipY],
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
  }, [getMaxPipY]);

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
  }, [getMaxPipY]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const handleMoveKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const step = event.shiftKey ? 40 : 10;
      let dx = 0;
      let dy = 0;
      switch (event.key) {
        case "ArrowLeft":
          dx = -step;
          break;
        case "ArrowRight":
          dx = step;
          break;
        case "ArrowUp":
          dy = -step;
          break;
        case "ArrowDown":
          dy = step;
          break;
        default:
          return;
      }
      event.preventDefault();
      setPip((prev) => {
        const height = (prev.width * 9) / 16;
        const maxY = getMaxPipY(height);
        return {
          x: Math.max(4, Math.min(prev.x + dx, window.innerWidth - prev.width - 4)),
          y: Math.max(4, Math.min(prev.y + dy, maxY)),
          width: prev.width,
        };
      });
    },
    [getMaxPipY],
  );

  const handleResizeKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const step = event.shiftKey ? 40 : 10;
      let dw = 0;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          dw = step;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          dw = -step;
          break;
        default:
          return;
      }
      event.preventDefault();
      setPip((prev) => {
        const nextWidth = Math.max(180, Math.min(prev.width + dw, window.innerWidth - 32));
        const height = (nextWidth * 9) / 16;
        const maxY = getMaxPipY(height);
        return {
          x: prev.x,
          y: Math.max(4, Math.min(prev.y, maxY)),
          width: nextWidth,
        };
      });
    },
    [getMaxPipY],
  );

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
  }, []);

  // Default tone styling (we'll use static values for now since tone detection is shell-owned)
  const cameraBaseClass = "border-border/50 bg-black/50 text-muted-foreground";
  const cameraHoverClass = "hover:bg-black/70 hover:text-foreground";
  const cameraActiveClass = "border-white/40 bg-white/10 text-white";
  const selectBaseClass = "border-border/50 bg-black/50 text-muted-foreground";
  const selectHoverClass = "hover:bg-black/70 hover:text-foreground";
  const selectOpenClass =
    "data-[state=open]:border-white/40 data-[state=open]:bg-white/10 data-[state=open]:text-white";

  return (
    <div className="fixed bottom-3 left-2 z-10 flex flex-col gap-2 sm:bottom-4 sm:left-4">
      <div ref={controlsRef} className="flex items-center gap-1.5 sm:gap-2">
        <Button
          variant="ghost"
          className={cn(
            "rounded-full backdrop-blur border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "h-9 w-9 p-0 sm:h-auto sm:w-auto sm:px-4 sm:py-2",
            "text-xs font-semibold uppercase tracking-wide",
            cameraBaseClass,
            cameraHoverClass,
            pipOpen && cameraActiveClass,
          )}
          aria-pressed={pipOpen}
          aria-label={pipOpen ? "Hide picture in picture" : "Show picture in picture"}
          onClick={() => setPipOpen((prev) => !prev)}
        >
          <Camera className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">Camera</span>
        </Button>
        <Select
          value={facingMode}
          onValueChange={(value) => setConfig({ facingMode: value as "user" | "environment" })}
        >
          <SelectTrigger
            aria-label="Camera facing"
            className={cn(
              "h-9 w-[100px] rounded-full border px-3 text-xs font-semibold uppercase tracking-wide backdrop-blur sm:w-[150px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selectBaseClass,
              selectHoverClass,
              selectOpenClass,
            )}
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
          display: pipOpen ? "block" : "none",
        }}
      >
        <div className="group relative aspect-video select-none">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Camera feed"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
            style={mirror && videoReady && isRunning ? { transform: "scaleX(-1)" } : undefined}
          />
          {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: Overlay canvas is decorative and not interactive */}
          <canvas
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          />
          <button
            type="button"
            aria-label="Move picture-in-picture window"
            className="absolute inset-0 cursor-move border-none bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onPointerDown={(event) => onPointerDown("move", event)}
            onKeyDown={handleMoveKeyDown}
          />
          {isRunning ? (
            <div className="pointer-events-none absolute inset-0 bg-black/35 opacity-0 transition group-hover:opacity-100" />
          ) : null}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
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
          <button
            type="button"
            aria-label="Hide picture-in-picture"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-black/55 text-white/80 transition hover:border-white/25 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={(event) => {
              event.stopPropagation();
              setPipOpen(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={mirror ? "Disable mirror" : "Enable mirror"}
            aria-pressed={mirror}
            className={cn(
              "absolute left-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-transparent transition hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              mirror
                ? "bg-black/55 text-white/80 hover:bg-black/70"
                : "bg-white/85 text-black shadow-sm ring-1 ring-black/20 hover:bg-white/95",
            )}
            onClick={(event) => {
              event.stopPropagation();
              setConfig({ mirror: !mirror });
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
            className="absolute bottom-2 left-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-transparent bg-black/55 text-white/80 transition hover:border-white/25 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={(event) => {
              event.stopPropagation();
              const nextHands = maxHands >= 4 ? 1 : maxHands + 1;
              setConfig({ maxHands: nextHands });
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <Hand className="h-3.5 w-3.5" />
            <span
              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[9px] font-semibold text-black"
              aria-hidden="true"
            >
              {maxHands}
            </span>
            <span className="sr-only">Max hands: {maxHands}</span>
          </button>
          <button
            type="button"
            aria-label="Resize picture-in-picture"
            className={cn(
              "absolute bottom-2 right-2 flex h-7 w-7 cursor-se-resize items-center justify-center rounded-full border border-transparent bg-black/55 text-white/80 transition hover:border-white/25 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isResizing &&
                "bg-white/85 text-black ring-1 ring-black/20 hover:bg-white/85 hover:text-black",
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              onPointerDown("resize", event);
            }}
            onKeyDown={handleResizeKeyDown}
          >
            <MoveDiagonal2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
