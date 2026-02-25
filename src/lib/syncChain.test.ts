import { isError } from "errore";
import { describe, expect, it, vi } from "vitest";
import { syncChain } from "./syncChain";

describe("syncChain", () => {
  it("runs next steps synchronously and in order, returning final value", () => {
    const steps: number[] = [];

    const result = syncChain(1)
      .next((value) => {
        steps.push(1);
        return value + 1;
      })
      .next((value) => {
        steps.push(2);
        return value + 1;
      })
      .next((value) => {
        steps.push(3);
        return value + 1;
      })();

    expect(steps).toEqual([1, 2, 3]);
    expect(result).toBe(4);
  });

  it("propagates thrown errors to final result and stops following next steps", () => {
    const afterThrow = vi.fn();

    const result = syncChain(10)
      .next(() => {
        throw new Error("boom");
      })
      .next(() => {
        afterThrow();
        return 0;
      })();

    expect(afterThrow).not.toHaveBeenCalled();
    expect(isError(result)).toBe(true);
    if (result instanceof Error) {
      expect(result.message).toBe("boom");
    }
  });

  it("propagates explicit ErrorOr errors from steps", () => {
    const result = syncChain(1)
      .next(() => new Error("step-failed"))
      .next(() => 2)();

    expect(isError(result)).toBe(true);
    if (result instanceof Error) {
      expect(result.message).toBe("step-failed");
    }
  });
});
