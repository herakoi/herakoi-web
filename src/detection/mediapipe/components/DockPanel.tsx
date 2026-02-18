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
import { useCallback, useEffect, useRef, useState } from "react";
import { Floating } from "#src/app/components/Floating";
import { Button } from "#src/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/app/components/ui/select";
import { cn } from "#src/app/lib/utils";
import type { DockPanelProps } from "#src/core/plugin";
import type { MediaPipeConfig } from "#src/core/pluginConfig";
import { registerOverlayRef, registerVideoRef } from "../refs";

export const MediaPipeDockPanel = ({
  isRunning,
  isInitializing,
  onStart,
  onStop,
  config,
  setConfig,
}: DockPanelProps<MediaPipeConfig>) => {
  const { mirror, maxHands, facingMode } = config;

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [pipOpen, setPipOpen] = useState(true);
  const [videoReady, setVideoReady] = useState(false);

  const isActive = isRunning || isInitializing;

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

  const getForbiddenAreas = useCallback((): Array<HTMLElement | null> => {
    return [controlsRef.current];
  }, []);

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
      <Floating
        open={pipOpen}
        initial={{ x: 16, y: 16, width: 260 }}
        aspectRatio={16 / 9}
        minWidth={180}
        padding={4}
        forbiddenGap={12}
        forbiddenAreas={getForbiddenAreas}
      >
        {({
          style,
          isResizing,
          onMovePointerDown,
          onMoveKeyDown,
          onResizePointerDown,
          onResizeKeyDown,
        }) => (
          <div
            className="overflow-hidden rounded-lg border border-border/70 bg-black/50 shadow-card backdrop-blur"
            style={style}
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
                onPointerDown={onMovePointerDown}
                onKeyDown={onMoveKeyDown}
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
                  onResizePointerDown(event);
                }}
                onKeyDown={onResizeKeyDown}
              >
                <MoveDiagonal2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Floating>
    </div>
  );
};
