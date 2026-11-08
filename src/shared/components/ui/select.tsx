import * as SelectPrimitive from "@radix-ui/react-select";
import { clsx } from "clsx";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import styles from "./select.module.css";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, tabIndex = 0, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={clsx(styles.trigger, className)}
    tabIndex={tabIndex}
    aria-haspopup="listbox"
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className={styles.triggerIcon} />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={clsx(styles.content, position === "popper" && styles.popper, className)}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={clsx(styles.viewport, position === "popper" && styles.viewportPopper)}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollUpButton className={styles.scrollButton}>
        <ChevronUp className={styles.icon} />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.ScrollDownButton className={styles.scrollButton}>
        <ChevronDown className={styles.icon} />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item ref={ref} className={clsx(styles.item, className)} {...props}>
    <span className={styles.itemIndicator}>
      <SelectPrimitive.ItemIndicator>
        <Check className={styles.icon} />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectLabel = SelectPrimitive.Label;
const SelectSeparator = SelectPrimitive.Separator;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
