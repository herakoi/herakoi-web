import { useMemo, useRef, useState } from "react";
import { Floating } from "#src/app/components/Floating";
import type { DockPanelProps } from "#src/core/plugin";
import type { MediaPipeConfig } from "../config";
import { useMediaPipeDockBindings } from "../hooks/useMediaPipeDockBindings";
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

  const { videoRef, overlayRef, videoReady } = useMediaPipeDockBindings();
  const controlsRef = useRef<HTMLDivElement>(null);
  const [pipOpen, setPipOpen] = useState(true);
  const initialPipLayout = useMemo(
    () => ({
      x: 16,
      y: typeof window === "undefined" ? 10_000 : window.innerHeight,
      width: 260,
    }),
    [],
  );

  const isActive = isRunning || isInitializing;

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
        forbiddenRefs={[controlsRef]}
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
