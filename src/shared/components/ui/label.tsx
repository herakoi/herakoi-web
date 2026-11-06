import * as React from "react";
import { cn } from "#src/shared/utils/cn";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { requiredMark?: boolean }
>(({ className, children, requiredMark, ...props }, ref) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: `htmlFor` is passed in by the caller when needed.
  <label
    ref={ref}
    className={cn(
      // A block with a 24px line keeps the spacing labels had as inline text in a 24px line:
      // Tailwind 4's space-y puts the gap as margin-bottom, which inline elements ignore.
      "block text-sm font-medium leading-6 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  >
    {children}
    {requiredMark ? <span className="text-destructive">*</span> : null}
  </label>
));
Label.displayName = "Label";

export { Label };
