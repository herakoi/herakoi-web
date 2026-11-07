import { clsx } from "clsx";
import { type ComponentType, useId, useState } from "react";
import { useShellT } from "#src/i18n/shell";
import { Popover, PopoverContent, PopoverTrigger } from "#src/shared/components/ui/popover";
import utilities from "#src/shared/styles/utilities.module.css";
import { useActivePlugin } from "#src/state/appConfigStore";
import styles from "./ModeToggle.module.css";
import { ScreenReaderAnnouncer } from "./ScreenReaderAnnouncer";

export type ModeToggleOption = {
  pluginId: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type ModeToggleProps = {
  slot: "detection" | "sonification";
  label: string;
  options: ModeToggleOption[];
  /** Switches the plugin; the shell passes a handler that also restarts transport. */
  onSelect: (pluginId: string) => void;
  /** `responsive`: vertical below the sm breakpoint, horizontal above. */
  orientation?: "horizontal" | "vertical" | "responsive";
};

/** Above this many options the inline switch becomes a single button that opens a picker. */
const MAX_INLINE_OPTIONS = 2;

/** Quick switch between the plugins of one pipeline slot, synced with Settings. */
export const ModeToggle = ({
  slot,
  label,
  options,
  onSelect,
  orientation = "horizontal",
}: ModeToggleProps) => {
  const t = useShellT();
  const [activeId] = useActivePlugin(slot);
  const [announcement, setAnnouncement] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const hintId = useId();
  const orientationClass =
    orientation === "vertical"
      ? styles.vertical
      : orientation === "responsive"
        ? styles.responsive
        : undefined;
  const hint = (
    <span id={hintId} className={utilities.srOnly}>
      {t(slot === "detection" ? "modeToggle.detectionHint" : "modeToggle.sonificationHint")}
    </span>
  );

  const select = (option: ModeToggleOption) => {
    setPickerOpen(false);
    // Reselecting the active mode would restart transport for nothing.
    if (option.pluginId === activeId) return;
    onSelect(option.pluginId);
    setAnnouncement(`${label}: ${option.label}`);
  };

  const renderOption = (option: ModeToggleOption, withLabel: boolean) => {
    const { pluginId, label: optionLabel, icon: Icon } = option;
    const isActive = activeId === pluginId;
    return (
      <button
        key={pluginId}
        type="button"
        aria-label={withLabel ? undefined : optionLabel}
        aria-pressed={isActive}
        onClick={() => select(option)}
        className={clsx(
          styles.button,
          withLabel && styles.withLabel,
          isActive ? styles.active : styles.inactive,
        )}
      >
        <Icon className={styles.optionIcon} />
        {withLabel ? <span className={styles.optionLabel}>{optionLabel}</span> : null}
      </button>
    );
  };

  // With fewer than two quick-switchable plugins there is nothing to switch.
  if (options.length < 2) return null;

  if (options.length > MAX_INLINE_OPTIONS) {
    const active = options.find((option) => option.pluginId === activeId) ?? options[0];
    const ActiveIcon = active.icon;
    return (
      <>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <div className={clsx(styles.rail, orientationClass)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${label}: ${active.label}`}
                aria-describedby={hintId}
                className={clsx(styles.button, styles.active)}
              >
                <ActiveIcon className={styles.icon} />
              </button>
            </PopoverTrigger>
          </div>
          <PopoverContent
            side={orientation === "vertical" ? "left" : "top"}
            sideOffset={8}
            className={styles.picker}
          >
            <fieldset aria-label={label} className={styles.options}>
              {options.map((option) => renderOption(option, true))}
            </fieldset>
          </PopoverContent>
        </Popover>
        {hint}
        <ScreenReaderAnnouncer message={announcement} />
      </>
    );
  }

  return (
    <>
      <fieldset
        aria-label={label}
        aria-describedby={hintId}
        className={clsx(styles.rail, orientationClass)}
      >
        {options.map((option) => renderOption(option, false))}
      </fieldset>
      {hint}
      <ScreenReaderAnnouncer message={announcement} />
    </>
  );
};
