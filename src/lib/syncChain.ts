import { isError, tryFn } from "errore";
import type { ErrorOr } from "#src/core/interfaces";

export type SyncChain<T> = (() => ErrorOr<T>) & {
  next<U>(fn: (value: T) => ErrorOr<U>): SyncChain<U>;
};

const fromResult = <T>(current: ErrorOr<T>): SyncChain<T> => {
  const chain = (() => current) as SyncChain<T>;

  chain.next = <U>(fn: (value: T) => ErrorOr<U>): SyncChain<U> => {
    if (isError(current)) {
      return fromResult<U>(current);
    }

    try {
      const next = tryFn({
        try: () => fn(current),
        catch: (error) => error,
      });
      return fromResult<U>(next);
    } catch (thrown) {
      if (thrown instanceof Error) {
        return fromResult<U>(thrown);
      }
      return fromResult<U>(new Error("syncChain step threw a non-Error value"));
    }
  };

  return chain;
};

export const syncChain = <T>(value: T): SyncChain<T> => {
  return fromResult<T>(value);
};
