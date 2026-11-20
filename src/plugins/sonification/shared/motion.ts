/**
 * Motion of each point, for sonifiers that play from movement rather than position alone.
 *
 * Why: sounding every frame plays far too much (tracker jitter and image texture change
 * the colour constantly). Tying sound to motion makes the hand the instrument: a still
 * hand is silent, a slow hand plays steadily, a fast hand plays fast.
 * What: MotionTracker.update() gives, per point and frame, its speed, whether it is
 * moving, and whether a note is due (for sonifiers that play separate notes).
 * How: the position is smoothed, and its speed is its displacement over the last
 * SPEED_WINDOW_MS. Jitter around one spot barely moves over that window, so it stays
 * below the "moving" threshold (with hysteresis, so the state does not flicker). While
 * moving, a note clock runs at `minRate` plus speed / `step` (one more note per `step`
 * travelled), capped at `maxRate`. A point that appears plays right away.
 */

import { type ImageSample, pointPositionKeys } from "#src/core/interfaces";

export type MotionOptions = {
  /** Extra note per this distance travelled, in canvas heights. */
  step: number;
  /** Notes per second while moving, however slowly. */
  minRate: number;
  /** Most notes per second for one point. */
  maxRate: number;
  /** Time constant of the position smoothing, in ms. */
  smoothingMs: number;
};

/** Window over which speed is measured. */
const SPEED_WINDOW_MS = 300;
/** Speeds (canvas heights per second) at which a point starts / stops counting as moving. */
const START_MOVING_SPEED = 0.05;
const STOP_MOVING_SPEED = 0.03;

type Sample = { x: number; y: number; t: number };

type PointState = {
  x: number;
  y: number;
  lastSeenMs: number;
  lastNoteMs: number;
  /** Smoothed positions within the speed window, oldest first. */
  history: Sample[];
  moving: boolean;
  /** Note clock: a note is due when it reaches 1. */
  phase: number;
};

export const defaultMotionOptions: MotionOptions = {
  step: 0.05,
  minRate: 2,
  maxRate: 12,
  smoothingMs: 60,
};

export type MotionState = {
  /** Smoothed speed, in canvas heights per second. */
  speed: number;
  moving: boolean;
  /** A note is due now (also when the point first appears). */
  note: boolean;
};

/** The point's canvas position from a sample (added by the engine), or null without one. */
export const samplePosition = (sample: ImageSample): { x: number; y: number } | null => {
  const x = sample.data[pointPositionKeys.x];
  const y = sample.data[pointPositionKeys.y];
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

export class MotionTracker {
  private points = new Map<string, PointState>();
  private options: MotionOptions;

  constructor(options: MotionOptions = defaultMotionOptions) {
    this.options = options;
  }

  configure(options: Partial<MotionOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /** Motion of point `id`, now at (x, y), at `nowMs`. */
  update(id: string, x: number, y: number, nowMs: number): MotionState {
    const state = this.points.get(id);
    if (!state) {
      // A point that appears plays right away: touching the image is a gesture too.
      this.points.set(id, {
        x,
        y,
        lastSeenMs: nowMs,
        lastNoteMs: nowMs,
        history: [{ x, y, t: nowMs }],
        moving: false,
        phase: 0,
      });
      return { speed: 0, moving: false, note: true };
    }

    const { step, minRate, maxRate, smoothingMs } = this.options;
    const dt = Math.max(0, nowMs - state.lastSeenMs);
    const alpha = smoothingMs > 0 ? 1 - Math.exp(-dt / smoothingMs) : 1;
    const previousX = state.x;
    const previousY = state.y;
    state.x += alpha * (x - state.x);
    state.y += alpha * (y - state.y);
    state.lastSeenMs = nowMs;

    state.history.push({ x: state.x, y: state.y, t: nowMs });
    while (state.history.length > 2 && nowMs - state.history[1].t >= SPEED_WINDOW_MS) {
      // Keep the newest sample that is at least a full window old.
      state.history.shift();
    }
    const oldest = state.history[0];
    const span = nowMs - oldest.t;
    // Until the window is full, a tiny jitter over a tiny time, or the smoothing settling
    // from the first (noisy) position, would look like motion.
    const speed =
      span >= SPEED_WINDOW_MS
        ? Math.hypot(state.x - oldest.x, state.y - oldest.y) / (span / 1000)
        : 0;
    state.moving = state.moving ? speed >= STOP_MOVING_SPEED : speed >= START_MOVING_SPEED;

    const result = { speed, moving: state.moving, note: false };
    if (!state.moving) return result;

    const travelled = Math.hypot(state.x - previousX, state.y - previousY);
    state.phase += (dt / 1000) * minRate + (step > 0 ? travelled / step : 0);
    if (state.phase < 1) return result;
    if (nowMs - state.lastNoteMs < 1000 / Math.max(0.1, maxRate)) return result;

    // At most one note is owed: a burst after the cap would sound like a stutter.
    state.phase = Math.min(1, state.phase - 1);
    state.lastNoteMs = nowMs;
    return { ...result, note: true };
  }

  /** Forget points that were not seen in the last frame. */
  retain(ids: ReadonlySet<string>): void {
    for (const id of this.points.keys()) {
      if (!ids.has(id)) this.points.delete(id);
    }
  }

  clear(): void {
    this.points.clear();
  }
}
