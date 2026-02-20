import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type FloatingLayout = { x: number; y: number; width: number };
type FloatingForbiddenRect = { x: number; y: number; width: number; height: number };

type FloatingDragMode = "move" | "resize";

type FloatingDragState = {
  mode: FloatingDragMode;
  startX: number;
  startY: number;
  startLayout: FloatingLayout;
};

export type FloatingRenderProps = {
  isResizing: boolean;
  onResizePointerDown: (event: PointerEvent<HTMLElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

type FloatingProps = {
  open: boolean;
  initial: FloatingLayout;
  aspectRatio?: number;
  minWidth?: number;
  maxWidth?: number;
  padding?: number;
  forbiddenGap?: number;
  keyboardStep?: number;
  keyboardStepShift?: number;
  forbiddenRefs?: Array<RefObject<HTMLElement>>;
  moveHandleAriaLabel?: string;
  onChange?: (next: FloatingLayout) => void;
  children: (props: FloatingRenderProps) => React.ReactNode;
};

const overlaps = (
  x: number,
  y: number,
  width: number,
  height: number,
  area: FloatingForbiddenRect,
): boolean => {
  return (
    x < area.x + area.width && x + width > area.x && y < area.y + area.height && y + height > area.y
  );
};

export const Floating = ({
  open,
  initial,
  aspectRatio = 16 / 9,
  minWidth = 180,
  maxWidth,
  padding = 4,
  forbiddenGap = 12,
  keyboardStep = 10,
  keyboardStepShift = 40,
  forbiddenRefs,
  moveHandleAriaLabel = "Move floating panel",
  onChange,
  children,
}: FloatingProps) => {
  const [layout, setLayout] = useState<FloatingLayout>(initial);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<FloatingDragState | null>(null);

  const getAreas = useCallback(() => {
    if (!forbiddenRefs) return [];
    const elements = forbiddenRefs.map((ref) => ref.current);
    return elements.flatMap((element) => {
      if (!element || !element.isConnected) return [];
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return [];
      return [
        {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
      ];
    });
  }, [forbiddenRefs]);

  const clampToViewport = useCallback(
    (value: FloatingLayout): FloatingLayout => {
      const viewportMaxWidth = Math.max(minWidth, window.innerWidth - padding * 2);
      const safeMaxWidth = Math.max(minWidth, maxWidth ?? viewportMaxWidth);
      const width = Math.max(minWidth, Math.min(value.width, safeMaxWidth, viewportMaxWidth));
      const height = width / aspectRatio;
      const maxX = Math.max(padding, window.innerWidth - width - padding);
      const maxY = Math.max(padding, window.innerHeight - height - padding);
      return {
        x: Math.max(padding, Math.min(value.x, maxX)),
        y: Math.max(padding, Math.min(value.y, maxY)),
        width,
      };
    },
    [aspectRatio, maxWidth, minWidth, padding],
  );

  const resolveForbiddenAreas = useCallback(
    (value: FloatingLayout): FloatingLayout => {
      let next = clampToViewport(value);
      let width = next.width;
      let height = width / aspectRatio;
      let guard = 0;

      while (guard < 20) {
        guard += 1;
        const blockingArea = getAreas().find((area) =>
          overlaps(next.x, next.y, width, height, area),
        );
        if (!blockingArea) break;

        const yAbove = clampToViewport({
          ...next,
          y: blockingArea.y - height - forbiddenGap,
        }).y;
        const aboveFree = !getAreas().some((area) => overlaps(next.x, yAbove, width, height, area));
        if (aboveFree) {
          next = { ...next, y: yAbove };
          continue;
        }

        const yBelow = clampToViewport({
          ...next,
          y: blockingArea.y + blockingArea.height + forbiddenGap,
        }).y;
        const belowFree = !getAreas().some((area) => overlaps(next.x, yBelow, width, height, area));
        if (belowFree) {
          next = { ...next, y: yBelow };
          continue;
        }

        const xLeft = clampToViewport({
          ...next,
          x: blockingArea.x - width - forbiddenGap,
        }).x;
        const leftFree = !getAreas().some((area) => overlaps(xLeft, next.y, width, height, area));
        if (leftFree) {
          next = { ...next, x: xLeft };
          continue;
        }

        const xRight = clampToViewport({
          ...next,
          x: blockingArea.x + blockingArea.width + forbiddenGap,
        }).x;
        const rightFree = !getAreas().some((area) => overlaps(xRight, next.y, width, height, area));
        if (rightFree) {
          next = { ...next, x: xRight };
          continue;
        }

        if (width <= minWidth) break;
        width = Math.max(minWidth, width - 16);
        next = clampToViewport({ ...next, width });
        height = next.width / aspectRatio;
      }

      return clampToViewport(next);
    },
    [aspectRatio, clampToViewport, forbiddenGap, getAreas, minWidth],
  );

  const applyLayout = useCallback(
    (candidate: FloatingLayout) => {
      setLayout(resolveForbiddenAreas(candidate));
    },
    [resolveForbiddenAreas],
  );

  const onPointerMove = useCallback(
    (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (drag.mode === "move") {
        applyLayout({
          x: drag.startLayout.x + dx,
          y: drag.startLayout.y + dy,
          width: drag.startLayout.width,
        });
        return;
      }
      applyLayout({
        x: drag.startLayout.x,
        y: drag.startLayout.y,
        width: drag.startLayout.width + dx,
      });
    },
    [applyLayout],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setIsResizing(false);
    window.removeEventListener("pointermove", onPointerMove);
  }, [onPointerMove]);

  const startDrag = useCallback(
    (mode: FloatingDragMode, event: PointerEvent<HTMLElement>) => {
      event.preventDefault();
      setIsResizing(mode === "resize");
      dragRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: layout,
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, { once: true });
    },
    [layout, onPointerMove, onPointerUp],
  );

  const onMoveKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const step = event.shiftKey ? keyboardStepShift : keyboardStep;
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
      applyLayout({
        x: layout.x + dx,
        y: layout.y + dy,
        width: layout.width,
      });
    },
    [applyLayout, keyboardStep, keyboardStepShift, layout.width, layout.x, layout.y],
  );

  const onResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const step = event.shiftKey ? keyboardStepShift : keyboardStep;
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
      applyLayout({
        x: layout.x,
        y: layout.y,
        width: layout.width + dw,
      });
    },
    [applyLayout, keyboardStep, keyboardStepShift, layout.width, layout.x, layout.y],
  );

  useEffect(() => {
    const handleViewportResize = () => {
      setLayout((prev) => resolveForbiddenAreas(prev));
    };
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, [resolveForbiddenAreas]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  useEffect(() => {
    setLayout((prev) => resolveForbiddenAreas(prev));
  }, [resolveForbiddenAreas]);

  useEffect(() => {
    onChange?.(layout);
  }, [layout, onChange]);

  const containerStyle: CSSProperties = {
    position: "fixed",
    left: layout.x,
    top: layout.y,
    width: layout.width,
    display: open ? "block" : "none",
    zIndex: 9,
  };

  return (
    <div style={containerStyle}>
      {children({
        isResizing,
        onResizePointerDown: (event) => startDrag("resize", event),
        onResizeKeyDown,
      })}
      <button
        type="button"
        aria-label={moveHandleAriaLabel}
        className="absolute inset-0 z-10 cursor-move border-none bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onPointerDown={(event) => startDrag("move", event)}
        onKeyDown={onMoveKeyDown}
      />
    </div>
  );
};
