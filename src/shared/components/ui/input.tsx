import { clsx } from "clsx";
import * as React from "react";
import styles from "./input.module.css";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return <input type={type} className={clsx(styles.input, className)} ref={ref} {...props} />;
  },
);
Input.displayName = "Input";

export { Input };
