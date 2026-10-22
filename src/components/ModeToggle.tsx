import { type ComponentType, useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "#src/shared/components/ui/popover";
import { cn } from "#src/shared/utils/cn";
import { useActivePlugin } from "#src/state/appConfigStore";
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
  orientation?: "horizontal" | "vertical";
  /** Extra classes for the rail, e.g. responsive layout overrides. */
  className?: string;
};

/** Above this many options the inline switch becomes a single button that opens a picker. */
const MAX_INLINE_OPTIONS = 2;

const buttonClass =
  "flex h-9 w-9 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const railClass =
  "pointer-events-auto flex items-center gap-1 rounded-full border border-border/50 bg-black/55 p-1 backdrop-blur";

/** Quick switch between the plugins of one pipeline slot, synced with Settings. */
export const ModeToggle = ({
  slot,
  label,
  options,
  onSelect,
  orientation = "horizontal",
  className,
}: ModeToggleProps) => {
  const [activeId] = useActivePlugin(slot);
  const [announcement, setAnnouncement] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const hintId = useId();
  const hint = (
    <span id={hintId} className="sr-only">
      Switches the active {slot} plugin. More options are in Settings.
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
        className={cn(
          buttonClass,
          withLabel && "w-full justify-start gap-2 px-3",
          isActive
            ? "bg-white/10 text-white"
            : "text-muted-foreground hover:bg-black/40 hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {withLabel ? <span className="text-sm">{optionLabel}</span> : null}
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
          <div className={cn(railClass, className)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${label}: ${active.label}`}
                aria-describedby={hintId}
                className={cn(buttonClass, "bg-white/10 text-white")}
              >
                <ActiveIcon className="h-4 w-4" />
              </button>
            </PopoverTrigger>
          </div>
          <PopoverContent
            side={orientation === "vertical" ? "left" : "top"}
            sideOffset={8}
            className="w-auto min-w-44 rounded-2xl border-border/50 bg-black/80 p-1 backdrop-blur"
          >
            <fieldset aria-label={label} className="flex flex-col gap-1">
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
        className={cn(railClass, orientation === "vertical" && "flex-col", className)}
      >
        {options.map((option) => renderOption(option, false))}
      </fieldset>
      {hint}
      <ScreenReaderAnnouncer message={announcement} />
    </>
  );
};
