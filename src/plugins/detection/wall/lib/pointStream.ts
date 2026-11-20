import type { DetectedPoint } from "#src/core/interfaces";

type Listener = (points: DetectedPoint[]) => void;

/** Async-iterable view over a set of point listeners (same contract as the other detectors). */
export const createPointStream = (
  listeners: Set<Listener>,
  signal?: AbortSignal,
): AsyncIterable<DetectedPoint[]> => ({
  [Symbol.asyncIterator](): AsyncIterator<DetectedPoint[]> {
    const queue: DetectedPoint[][] = [];
    let waiting: ((value: IteratorResult<DetectedPoint[]>) => void) | null = null;
    let done = false;

    const close = () => {
      if (done) return;
      done = true;
      listeners.delete(push);
      signal?.removeEventListener("abort", close);
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ value: undefined, done: true });
      }
    };

    const push = (points: DetectedPoint[]) => {
      if (done) return;
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ value: points, done: false });
        return;
      }
      // Keep only the newest batch: a slow consumer should not replay stale frames.
      queue.length = 0;
      queue.push(points);
    };

    listeners.add(push);
    if (signal?.aborted) close();
    else signal?.addEventListener("abort", close, { once: true });

    return {
      next: async () => {
        if (done) return { value: undefined, done: true };
        const queued = queue.shift();
        if (queued) return { value: queued, done: false };
        return new Promise<IteratorResult<DetectedPoint[]>>((resolve) => {
          waiting = resolve;
        });
      },
      return: async () => {
        close();
        return { value: undefined, done: true };
      },
      throw: async (error) => {
        close();
        throw error;
      },
    };
  },
});
