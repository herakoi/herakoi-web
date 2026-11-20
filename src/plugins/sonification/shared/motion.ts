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
 * travelled), capped at `maxRate`. A point that appears plays right away. When it comes to
 * rest, `rest` decides: play one note after REST_DELAY_MS ("once"), repeat every
 * REST_REPEAT_MS while resting ("repeat"), or stay silent ("silent").
 */

import { type ImageSample, pointPositionKeys } from "#src/core/interfaces";

/** What a point does when it stops moving. */
export type RestBehavior = "once" | "repeat" | "silent";

export const restBehaviors: readonly RestBehavior[] = ["once", "repeat", "silent"];

export type MotionOptions = {
  /** What to play when the point rests in one spot. */
  rest: RestBehavior;
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
/** How long a point must rest before its rest note plays. */
const REST_DELAY_MS = 350;
/** Interval of repeated rest notes. */
const REST_REPEAT_MS = 1000;

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
  /** When the point last came to rest (or appeared). */
  restSinceMs: number;
  /** Whether a note was played in the current rest. */
  restPlayed: boolean;
};

export const defaultMotionOptions: MotionOptions = {
  rest: "once",
  step: 0.05,
  minRate: 2,
  maxRate: 12,
  smoothingMs: 60,
};

export type MotionState = {
  /** Smoothed speed, in canvas heights per second. */
  speed: number;
  moving: boolean;
  /** A note is due now (also when the point first appears, and when it rests). */
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
        // The appearance note counts as the first rest note.
        restSinceMs: nowMs,
        restPlayed: true,
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
    const wasMoving = state.moving;
    state.moving = state.moving ? speed >= STOP_MOVING_SPEED : speed >= START_MOVING_SPEED;
    if (wasMoving && !state.moving) {
      state.restSinceMs = nowMs;
      state.restPlayed = false;
    }

    const result = { speed, moving: state.moving, note: false };
    if (!state.moving) return this.restNote(state, nowMs) ? { ...result, note: true } : result;

    const travelled = Math.hypot(state.x - previousX, state.y - previousY);
    state.phase += (dt / 1000) * minRate + (step > 0 ? travelled / step : 0);
    if (state.phase < 1) return result;
    if (nowMs - state.lastNoteMs < 1000 / Math.max(0.1, maxRate)) return result;

    // At most one note is owed: a burst after the cap would sound like a stutter.
    state.phase = Math.min(1, state.phase - 1);
    state.lastNoteMs = nowMs;
    return { ...result, note: true };
  }

  /** Whether a resting point plays now, as its rest behaviour asks. */
  private restNote(state: PointState, nowMs: number): boolean {
    const { rest } = this.options;
    if (rest === "silent" || nowMs - state.restSinceMs < REST_DELAY_MS) return false;
    const due =
      !state.restPlayed || (rest === "repeat" && nowMs - state.lastNoteMs >= REST_REPEAT_MS);
    if (!due) return false;
    state.restPlayed = true;
    state.lastNoteMs = nowMs;
    return true;
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
