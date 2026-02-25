import { tryAsync } from "errore";
import { PluginCreationError } from "#src/core/domain-errors";
import type { ErrorOr } from "#src/core/interfaces";

export const safelyCreatePluginHandle = async <T>(
  create: () => ErrorOr<T> | Promise<ErrorOr<T>>,
): Promise<ErrorOr<T>> => {
  return tryAsync({
    try: async () => create(),
    catch: (error) => new PluginCreationError({ cause: error }),
  });
};
