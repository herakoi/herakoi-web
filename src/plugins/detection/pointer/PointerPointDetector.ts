import type {
  DetectedPoint,
  ErrorOr,
  PointDetectionCallback,
  PointDetector,
} from "#src/core/interfaces";
import { PointerOverlayNotMountedError } from "./errors";

type GetOverlayCanvas = () => HTMLCanvasElement | null;

type PointerPosition = {
  x: number;
  y: number;
  inside: boolean;
};

const MOUSE_POINT_ID = "pointer-mouse";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest("button, a, input, select, textarea, label, [role='button']") !== null;
};

export class PointerPointDetector implements PointDetector {
  private readonly getOverlayCanvas: GetOverlayCanvas;
  private readonly callbacks: PointDetectionCallback[] = [];
  private readonly activePoints = new Map<string, DetectedPoint>();

  private initialized = false;
  private started = false;

  private readonly onPointerMoveBound: (event: PointerEvent) => void;
  private readonly onPointerDownBound: (event: PointerEvent) => void;
  private readonly onPointerUpBound: (event: PointerEvent) => void;
  private readonly onPointerCancelBound: (event: PointerEvent) => void;
  private readonly onWindowBlurBound: () => void;
  private readonly onVisibilityChangeBound: () => void;

  constructor(getOverlayCanvas: GetOverlayCanvas) {
    this.getOverlayCanvas = getOverlayCanvas;
    this.onPointerMoveBound = (event) => this.onPointerMove(event);
    this.onPointerDownBound = (event) => this.onPointerDown(event);
    this.onPointerUpBound = (event) => this.onPointerUp(event);
    this.onPointerCancelBound = (event) => this.onPointerCancel(event);
    this.onWindowBlurBound = () => this.clearActivePoints();
    this.onVisibilityChangeBound = () => {
      if (document.hidden) {
        this.clearActivePoints();
      }
    };
  }

  async initialize(): Promise<ErrorOr<undefined>> {
    this.initialized = true;
    return undefined;
  }

  start(): ErrorOr<undefined> {
    if (!this.initialized) {
      return new Error("PointerPointDetector must be initialized before calling start().");
    }
    if (this.started) return;

    const overlayCanvas = this.getOverlayCanvas();
    if (!overlayCanvas) {
      return new PointerOverlayNotMountedError();
    }

    this.started = true;
    window.addEventListener("pointermove", this.onPointerMoveBound);
    window.addEventListener("pointerdown", this.onPointerDownBound);
    window.addEventListener("pointerup", this.onPointerUpBound);
    window.addEventListener("pointercancel", this.onPointerCancelBound);
    window.addEventListener("blur", this.onWindowBlurBound);
    document.addEventListener("visibilitychange", this.onVisibilityChangeBound);
  }

  stop(): void {
    if (!this.started) return;

    window.removeEventListener("pointermove", this.onPointerMoveBound);
    window.removeEventListener("pointerdown", this.onPointerDownBound);
    window.removeEventListener("pointerup", this.onPointerUpBound);
    window.removeEventListener("pointercancel", this.onPointerCancelBound);
    window.removeEventListener("blur", this.onWindowBlurBound);
    document.removeEventListener("visibilitychange", this.onVisibilityChangeBound);

    this.started = false;
    this.clearActivePoints({ emitWhenAlreadyEmpty: true });
  }

  onPointsDetected(callback: PointDetectionCallback): void {
    this.callbacks.push(callback);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.started) return;

    if (event.pointerType === "mouse") {
      this.handleMouseMove(event);
      return;
    }

    const pointId = this.getPointId(event);
    if (!this.activePoints.has(pointId)) return;

    const position = this.getNormalizedPointerPosition(event);
    if (!position?.inside) {
      this.activePoints.delete(pointId);
      this.emitActivePoints();
      return;
    }

    this.activePoints.set(pointId, { id: pointId, x: position.x, y: position.y });
    this.emitActivePoints();
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.started || event.pointerType === "mouse") return;
    if (isInteractiveTarget(event.target)) return;

    const position = this.getNormalizedPointerPosition(event);
    if (!position?.inside) return;

    const pointId = this.getPointId(event);
    this.activePoints.set(pointId, { id: pointId, x: position.x, y: position.y });
    this.emitActivePoints();
  }

  private onPointerUp(event: PointerEvent): void {
    if (event.pointerType === "mouse") return;

    const pointId = this.getPointId(event);
    if (!this.activePoints.has(pointId)) return;
    this.activePoints.delete(pointId);
    this.emitActivePoints();
  }

  private onPointerCancel(event: PointerEvent): void {
    this.onPointerUp(event);
  }

  private clearActivePoints(options?: { emitWhenAlreadyEmpty?: boolean }): void {
    const hasPoints = this.activePoints.size > 0;
    this.activePoints.clear();

    if (hasPoints || options?.emitWhenAlreadyEmpty) {
      this.emitPoints([]);
    }
  }

  private handleMouseMove(event: PointerEvent): void {
    if (!event.isPrimary) return;
    const pointId = MOUSE_POINT_ID;

    if (isInteractiveTarget(event.target)) {
      if (!this.activePoints.has(pointId)) return;
      this.activePoints.delete(pointId);
      this.emitActivePoints();
      return;
    }

    const position = this.getNormalizedPointerPosition(event);
    if (!position?.inside) {
      if (!this.activePoints.has(pointId)) return;
      this.activePoints.delete(pointId);
      this.emitActivePoints();
      return;
    }

    this.activePoints.set(pointId, { id: pointId, x: position.x, y: position.y });
    this.emitActivePoints();
  }

  private getNormalizedPointerPosition(event: PointerEvent): PointerPosition | null {
    const overlayCanvas = this.getOverlayCanvas();
    if (!overlayCanvas) return null;

    const rect = overlayCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const normalizedX = (event.clientX - rect.left) / rect.width;
    const normalizedY = (event.clientY - rect.top) / rect.height;

    return {
      x: clamp01(normalizedX),
      y: clamp01(normalizedY),
      inside: normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1,
    } satisfies PointerPosition;
  }

  private emitPoints(points: DetectedPoint[]): void {
    for (const callback of this.callbacks) {
      callback(points);
    }
  }

  private emitActivePoints(): void {
    const points = [...this.activePoints.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    this.emitPoints(points);
  }

  private getPointId(event: PointerEvent): string {
    if (event.pointerType === "mouse") return MOUSE_POINT_ID;
    return `pointer-${event.pointerType}-${event.pointerId}`;
  }
}
