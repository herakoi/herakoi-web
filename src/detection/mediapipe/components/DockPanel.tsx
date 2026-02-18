import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Floating } from "#src/app/components/Floating";
import type { DockPanelProps } from "#src/core/plugin";
import type { MediaPipeConfig } from "#src/core/pluginConfig";
import { registerOverlayRef, registerVideoRef } from "../refs";
import { DockPanelControls } from "./DockPanelControls";
import { DockPanelPiPActions } from "./DockPanelPiPActions";
import { DockPanelPiPTransport } from "./DockPanelPiPTransport";

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
  const initialPipLayout = useMemo(
    () => ({
      x: 16,
      y: typeof window === "undefined" ? 10_000 : window.innerHeight,
      width: 260,
    }),
    [],
  );

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

  return (
    <div className="fixed bottom-3 left-2 z-10 flex flex-col gap-2 sm:bottom-4 sm:left-4">
      <div ref={controlsRef}>
        <DockPanelControls
          pipOpen={pipOpen}
          facingMode={facingMode}
          onTogglePip={() => setPipOpen((prev) => !prev)}
          onFacingModeChange={(value) => setConfig({ facingMode: value })}
        />
      </div>
      <Floating
        open={pipOpen}
        initial={initialPipLayout}
        aspectRatio={16 / 9}
        minWidth={180}
        padding={4}
        forbiddenGap={12}
        forbiddenAreas={getForbiddenAreas}
        moveHandleAriaLabel="Move picture-in-picture window"
      >
        {({ isResizing, onResizePointerDown, onResizeKeyDown }) => (
          <div className="relative overflow-hidden rounded-lg border border-border/70 bg-black/50 shadow-card backdrop-blur">
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
              <DockPanelPiPTransport
                isRunning={isRunning}
                isInitializing={isInitializing}
                isActive={isActive}
                onStart={onStart}
                onStop={onStop}
              />
              <DockPanelPiPActions
                mirror={mirror}
                maxHands={maxHands}
                isResizing={isResizing}
                onHide={() => setPipOpen(false)}
                onToggleMirror={() => setConfig({ mirror: !mirror })}
                onCycleMaxHands={() => setConfig({ maxHands: maxHands >= 4 ? 1 : maxHands + 1 })}
                onResizePointerDown={onResizePointerDown}
                onResizeKeyDown={onResizeKeyDown}
              />
            </div>
          </div>
        )}
      </Floating>
    </div>
  );
};
