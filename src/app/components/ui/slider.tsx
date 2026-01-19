import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "../../lib/utils";

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  /**
   * Optional aria-labels for each thumb to improve screen reader support.
   * If omitted, falls back to the root aria-label or a generic label.
   */
  thumbLabels?: string[];
};

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, thumbLabels, value, defaultValue, "aria-label": ariaLabel, ...props }, ref) => {
    const thumbCount = Math.max(
      1,
      (Array.isArray(value) ? value.length : 0) ||
        (Array.isArray(defaultValue) ? defaultValue.length : 0) ||
        1,
    );
    const labels =
      thumbLabels && thumbLabels.length === thumbCount
        ? thumbLabels
        : Array.from({ length: thumbCount }, (_, i) =>
            ariaLabel ? `${ariaLabel} ${i + 1}` : `Slider thumb ${i + 1}`,
          );

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        value={value}
        defaultValue={defaultValue}
        aria-label={ariaLabel}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        {labels.map((label, _index) => (
          <SliderPrimitive.Thumb
            key={label}
            aria-label={label}
            className="block h-4 w-4 rounded-full border border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
