import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import type { FloatingRenderProps } from "./Floating";
import { Floating } from "./Floating";

afterEach(cleanup);

describe("Floating — render props", () => {
  test("passes resize handlers to children", async () => {
    render(
      <Floating open initial={{ x: 0, y: 0, width: 260 }}>
        {(props: FloatingRenderProps) => (
          <div
            data-testid="content"
            data-has-resize-down={typeof props.onResizePointerDown === "function" ? "yes" : "no"}
            data-has-resize-key={typeof props.onResizeKeyDown === "function" ? "yes" : "no"}
          />
        )}
      </Floating>,
    );
    const content = page.getByTestId("content");
    await expect.element(content).toBeInTheDocument();
    await expect.element(content).toHaveAttribute("data-has-resize-down", "yes");
    await expect.element(content).toHaveAttribute("data-has-resize-key", "yes");
  });

  test("renders a standalone move handle button outside children", async () => {
    render(
      <Floating open initial={{ x: 0, y: 0, width: 260 }} moveHandleAriaLabel="Move panel">
        {() => <div data-testid="content" />}
      </Floating>,
    );
    const buttons = page.getByRole("button", { name: "Move panel" }).elements();
    expect(buttons).toHaveLength(1);
  });
});
