import { createTaggedError, isError, matchError } from "errore";

export class UnknownError extends createTaggedError({
  name: "UnknownError",
  message: "$message",
}) {}

export const ensureError = (value: unknown, fallbackMessage: string): Error => {
  if (isError(value)) return value;
  return new UnknownError({ message: fallbackMessage, cause: value });
};

export const getErrorMessage = (error: Error): string =>
  matchError(error as Error | InstanceType<typeof UnknownError>, {
    UnknownError: (typed) => typed.message,
    Error: (typed) => typed.message,
  });
