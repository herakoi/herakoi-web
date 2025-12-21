import { useCallback, useEffect, useRef } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

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
  pip: PiPState;
  setPip: React.Dispatch<React.SetStateAction<PiPState>>;
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
};

export const PiPPanel = ({
  open,
  onToggle,
  mirror,
  pip,
  setPip,
  videoRef,
  overlayRef,
}: PiPPanelProps) => {
  const dragRef = useRef<DragState | null>(null);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragRef.current) return;
      const { mode, startX, startY, startPip } = dragRef.current;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (mode === "move") {
        const height = (startPip.width * 9) / 16;
        setPip({
          x: Math.max(4, Math.min(startPip.x + dx, window.innerWidth - startPip.width - 4)),
          y: Math.max(4, Math.min(startPip.y + dy, window.innerHeight - height - 4)),
          width: startPip.width,
        });
      } else {
        const nextWidth = Math.max(180, Math.min(startPip.width + dx, window.innerWidth - 32));
        const height = (nextWidth * 9) / 16;
        const maxY = window.innerHeight - height - 4;
        setPip({
          x: startPip.x,
          y: Math.max(4, Math.min(startPip.y, maxY)),
          width: nextWidth,
        });
      }
    },
    [setPip],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (mode: "move" | "resize", event: React.PointerEvent<HTMLDivElement | HTMLButtonElement>) => {
      event.preventDefault();
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
      const nextY = window.innerHeight - height - 16;
      return { ...prev, y: Math.max(8, nextY) };
    });
  }, [setPip]);

  useEffect(() => {
    const handleResize = () => {
      setPip((prev) => {
        const height = (prev.width * 9) / 16;
        return {
          x: Math.max(8, Math.min(prev.x, window.innerWidth - prev.width - 8)),
          y: Math.max(8, Math.min(prev.y, window.innerHeight - height - 8)),
          width: Math.min(prev.width, window.innerWidth - 32),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setPip]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  return (
    <div className="fixed bottom-4 left-4 z-10 flex flex-col gap-2">
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
        PiP
      </Button>
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
        onPointerDown={(event) => onPointerDown("move", event)}
      >
        <div className="relative aspect-video cursor-move select-none">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover opacity-80"
            style={mirror ? { transform: "scaleX(-1)" } : undefined}
          />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          <div className="absolute left-2 top-2 flex items-center gap-2 rounded-full bg-muted/60 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            PiP camera
          </div>
          <button
            type="button"
            aria-label="Hide picture-in-picture"
            className="absolute right-2 top-2 h-5 w-5 rounded-full bg-black/50 text-xs font-bold text-white/80 hover:bg-black/70"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            ×
          </button>
          <button
            type="button"
            aria-label="Resize picture-in-picture"
            className="absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded bg-white/40"
            onPointerDown={(event) => {
              event.stopPropagation();
              onPointerDown("resize", event);
            }}
          />
        </div>
      </div>
    </div>
  );
};
