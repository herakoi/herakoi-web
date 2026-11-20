import { describe, expect, it } from "vitest";
import { MotionTracker } from "./motion";

const FRAME_MS = 1000 / 30;

/** Feed a path frame by frame; return how many notes it played. */
const countNotes = (
  trigger: MotionTracker,
  path: (frame: number) => { x: number; y: number },
  frames: number,
) => {
  let notes = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const { x, y } = path(frame);
    if (trigger.update("a", x, y, frame * FRAME_MS).note) notes += 1;
  }
  return notes;
};

const options = { step: 0.05, minRate: 2, maxRate: 12, smoothingMs: 60 };

const sweep = (speed: number) => (frame: number) => ({
  x: 0.1 + (speed * (frame * FRAME_MS)) / 1000,
  y: 0.5,
});

describe("MotionTracker", () => {
  it("plays once when a point appears, then nothing while it stays still", () => {
    expect(countNotes(new MotionTracker(options), () => ({ x: 0.5, y: 0.5 }), 90)).toBe(1);
  });

  it("does not let tracker jitter add up to notes", () => {
    // ±1% wobble around one spot for three seconds (stronger than MediaPipe's usual jitter).
    const jitter = (frame: number) => ({
      x: 0.5 + 0.01 * Math.sin(frame * 2.1),
      y: 0.5 + 0.01 * Math.cos(frame * 3.7),
    });
    expect(countNotes(new MotionTracker(options), jitter, 90)).toBe(1);
  });

  it("keeps playing at the minimum rate when the hand moves slowly", () => {
    // 0.06 canvas heights per second: about a minute to cross the screen.
    const notes = countNotes(new MotionTracker(options), sweep(0.06), 90);
    // Three seconds: the first note, then about (2 + 0.06 / 0.05) per second once moving.
    expect(notes).toBeGreaterThanOrEqual(6);
    expect(notes).toBeLessThanOrEqual(11);
  });

  it("plays more notes the faster the hand moves", () => {
    // Two seconds of movement: 0.2 and 0.5 canvas heights per second.
    const slow = countNotes(new MotionTracker(options), sweep(0.2), 60);
    const fast = countNotes(new MotionTracker(options), sweep(0.5), 60);
    expect(slow).toBeGreaterThanOrEqual(8);
    expect(fast).toBeGreaterThan(slow + 5);
  });

  it("caps the note rate", () => {
    // Very fast: 3 canvas heights per second would be ~60 notes a second; the cap allows 12.
    // Two seconds, the first 0.3 s spent measuring speed. At 30 frames per second, "83 ms
    // apart" means every third frame: 10 notes per second in practice.
    const notes = countNotes(
      new MotionTracker(options),
      (frame) => ({ x: (3 * (frame * FRAME_MS)) / 1000, y: 0.5 }),
      60,
    );
    expect(notes).toBeLessThanOrEqual(25);
    expect(notes).toBeGreaterThanOrEqual(16);
  });

  it("plays again for a point that comes back", () => {
    const trigger = new MotionTracker(options);
    trigger.update("a", 0.5, 0.5, 0);
    trigger.retain(new Set());
    expect(trigger.update("a", 0.5, 0.5, 100).note).toBe(true);
  });

  it("reports speed and whether the point is moving", () => {
    const tracker = new MotionTracker(options);
    let state = tracker.update("a", 0.1, 0.5, 0);
    for (let frame = 1; frame <= 30; frame += 1) {
      state = tracker.update("a", 0.1 + (0.4 * frame * FRAME_MS) / 1000, 0.5, frame * FRAME_MS);
    }
    expect(state.moving).toBe(true);
    expect(state.speed).toBeGreaterThan(0.3);
    expect(state.speed).toBeLessThan(0.45);
  });
});
