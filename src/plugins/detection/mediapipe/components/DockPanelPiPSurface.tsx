import type { ReactNode, RefObject } from "react";

type DockPanelPiPSurfaceProps = {
  videoRef: RefObject<HTMLVideoElement>;
  overlayRef: RefObject<HTMLCanvasElement>;
  isRunning: boolean;
  mirror: boolean;
  videoReady: boolean;
  children: ReactNode;
};

export const DockPanelPiPSurface = ({
  videoRef,
  overlayRef,
  isRunning,
  mirror,
  videoReady,
  children,
}: DockPanelPiPSurfaceProps) => {
  return (
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
        {children}
      </div>
    </div>
  );
};
