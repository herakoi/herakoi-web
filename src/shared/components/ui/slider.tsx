import * as SliderPrimitive from "@radix-ui/react-slider";
import { clsx } from "clsx";
import * as React from "react";
import styles from "./slider.module.css";

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
        className={clsx(styles.root, className)}
        value={value}
        defaultValue={defaultValue}
        aria-label={ariaLabel}
        {...props}
      >
        <SliderPrimitive.Track className={styles.track}>
          <SliderPrimitive.Range className={styles.range} />
        </SliderPrimitive.Track>
        {labels.map((label) => (
          <SliderPrimitive.Thumb key={label} aria-label={label} className={styles.thumb} />
        ))}
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
