import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import * as React from "react";
import styles from "./button.module.css";

const variants = {
  default: styles.variantDefault,
  outline: styles.variantOutline,
  ghost: styles.variantGhost,
  secondary: styles.variantSecondary,
};

const sizes = {
  default: styles.sizeDefault,
  sm: styles.sizeSm,
  lg: styles.sizeLg,
  icon: styles.sizeIcon,
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const { type = "button", ...rest } = props;
    return (
      <Comp
        className={clsx(styles.button, variants[variant], sizes[size], className)}
        ref={ref}
        type={type}
        {...rest}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
