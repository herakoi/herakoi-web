import { clsx } from "clsx";
import * as React from "react";
import styles from "./label.module.css";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { requiredMark?: boolean }
>(({ className, children, requiredMark, ...props }, ref) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: `htmlFor` is passed in by the caller when needed.
  <label ref={ref} className={clsx(styles.label, className)} {...props}>
    {children}
    {requiredMark ? <span className={styles.requiredMark}>*</span> : null}
  </label>
));
Label.displayName = "Label";

export { Label };
