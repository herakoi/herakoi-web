import * as SwitchPrimitives from "@radix-ui/react-switch";
import { clsx } from "clsx";
import * as React from "react";
import styles from "./switch.module.css";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root className={clsx(styles.root, className)} {...props} ref={ref}>
    <SwitchPrimitives.Thumb className={styles.thumb} />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
