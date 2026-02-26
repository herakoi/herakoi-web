import { FlipHorizontal, Hand, MoveDiagonal2, X } from "lucide-react";
import type { KeyboardEvent, PointerEvent } from "react";
import { cn } from "#src/shared/utils/cn";

type DockPanelPiPActionsProps = {
  mirror: boolean;
  maxHands: number;
  isResizing: boolean;
  onHide: () => void;
  onToggleMirror: () => void;
  onCycleMaxHands: () => void;
  onResizePointerDown: (event: PointerEvent<HTMLElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export const DockPanelPiPActions = ({
  mirror,
  maxHands,
  isResizing,
  onHide,
  onToggleMirror,
  onCycleMaxHands,
  onResizePointerDown,
  onResizeKeyDown,
}: DockPanelPiPActionsProps) => {
  return (
    <>
      <button
        type="button"
        aria-label="Hide picture-in-picture"
        className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-black/55 text-white/80 transition hover:border-white/25 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={(event) => {
          event.stopPropagation();
          onHide();
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
          "z-20",
          mirror
            ? "bg-white/85 text-black shadow-sm ring-1 ring-black/20 hover:bg-white/95"
            : "bg-black/55 text-white/80 hover:bg-black/70",
        )}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMirror();
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
        className="absolute bottom-2 left-2 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-transparent bg-black/55 text-white/80 transition hover:border-white/25 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={(event) => {
          event.stopPropagation();
          onCycleMaxHands();
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
          "absolute bottom-2 right-2 flex h-7 w-7 touch-none cursor-se-resize items-center justify-center rounded-full border border-transparent bg-black/55 text-white/80 transition hover:border-white/25 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "z-20",
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
    </>
  );
};
