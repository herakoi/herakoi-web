import { describe, expect, it } from "vitest";
import { EngineCanvasNotReadyError, PluginCreationError } from "#src/core/domain-errors";
import { safelyCreatePluginHandle } from "./runtime";

describe("engine runtime utils", () => {
  it("safelyCreatePluginHandle returns created handle on success", async () => {
    const handle = { name: "ok-handle" };
    const result = await safelyCreatePluginHandle(async () => handle);
    expect(result).toEqual(handle);
  });

  it("safelyCreatePluginHandle preserves ErrorOr errors", async () => {
    const originalError = new EngineCanvasNotReadyError();
    const result = await safelyCreatePluginHandle(async () => originalError);
    expect(result).toBe(originalError);
  });

  it("safelyCreatePluginHandle wraps thrown errors with PluginCreationError", async () => {
    const result = await safelyCreatePluginHandle(async () => {
      throw new Error("boom");
    });

    expect(result).toBeInstanceOf(PluginCreationError);
  });
});
