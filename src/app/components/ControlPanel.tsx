import { CircleHelp, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../lib/utils";
import { HelpPanelContent } from "./HelpPanel";
import { Button } from "./ui/button";
import { CardContent } from "./ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export type ControlPanelSection<K extends string = string> = {
  key: K;
  label: string;
  title?: string;
  icon?: React.ReactNode;
  render: () => React.ReactNode;
};

type ControlPanelProps<K extends string> = {
  error: string | null;
  className?: string;
  style?: React.CSSProperties;
  openSection: K | null;
  setOpenSection: React.Dispatch<React.SetStateAction<K | null>>;
  sections: ControlPanelSection<K>[];
  settingsTone: "light" | "dark";
  helpTone: "light" | "dark";
  settingsButtonRef: React.RefObject<HTMLButtonElement>;
  helpButtonRef: React.RefObject<HTMLButtonElement>;
};

export const ControlPanel = <K extends string>({
  error,
  className,
  style,
  openSection,
  setOpenSection,
  sections,
  settingsTone,
  helpTone,
  settingsButtonRef,
  helpButtonRef,
}: ControlPanelProps<K>) => {
  const defaultKey = useMemo(() => {
    return sections[0]?.key ?? null;
  }, [sections]);

  const open = Boolean(openSection);
  const value = openSection ?? defaultKey;
  const [helpOpen, setHelpOpen] = useState(false);

  const settingsBaseClass =
    settingsTone === "dark"
      ? "border-black/30 bg-black/40 text-white/90"
      : "border-border/50 bg-black/50 text-muted-foreground";
  const settingsHoverClass =
    settingsTone === "dark"
      ? "hover:bg-black/55 hover:text-white"
      : "hover:bg-black/70 hover:text-foreground";
  const settingsActiveClass =
    settingsTone === "dark"
      ? "border-black/50 bg-black/70 text-white"
      : "border-white/40 bg-white/10 text-white";
  const helpBaseClass =
    helpTone === "dark"
      ? "border-black/30 bg-black/40 text-white/90"
      : "border-border/50 bg-black/50 text-muted-foreground";
  const helpHoverClass =
    helpTone === "dark"
      ? "hover:bg-black/55 hover:text-white"
      : "hover:bg-black/70 hover:text-foreground";
  const helpActiveClass =
    helpTone === "dark"
      ? "border-black/50 bg-black/70 text-white"
      : "border-white/40 bg-white/10 text-white";

  return (
    <div
      className={cn(
        "fixed bottom-3 right-2 z-10 flex flex-col items-end gap-2 sm:bottom-4 sm:right-4",
        className,
      )}
      style={style}
    >
      <div className="flex items-center gap-2">
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            if (!defaultKey) return;
            setOpenSection(nextOpen ? (value ?? defaultKey) : null);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "rounded-full backdrop-blur border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "h-9 w-9 p-0 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2",
                "text-xs font-semibold uppercase tracking-wide",
                settingsBaseClass,
                settingsHoverClass,
                open && settingsActiveClass,
              )}
              aria-label="Toggle controls panel"
              ref={settingsButtonRef}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </PopoverTrigger>
          {defaultKey && value ? (
            <PopoverContent
              align="end"
              side="top"
              sideOffset={8}
              className="max-h-[min(80vh,500px)] w-[calc(100vw-1rem)] border border-border/60 bg-card/80 p-0 text-card-foreground shadow-card backdrop-blur sm:w-[400px]"
            >
              <CardContent className="flex flex-col gap-3 pt-4">
                <Tabs
                  value={value}
                  onValueChange={(nextValue) => setOpenSection(nextValue as K)}
                  className="flex h-full flex-col"
                >
                  <TabsList className="grid w-full grid-cols-4 gap-1 rounded-full border border-white/10 bg-black/25 p-1">
                    {sections.map((section) => (
                      <TabsTrigger
                        key={section.key}
                        value={section.key}
                        className="flex items-center justify-center gap-1.5 rounded-full border border-transparent px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60 transition data-[state=active]:border-white/40 data-[state=active]:bg-white/25 data-[state=active]:text-white data-[state=active]:shadow-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {section.icon ? (
                          <span className="flex h-3 w-3 items-center justify-center text-white/70">
                            {section.icon}
                          </span>
                        ) : null}
                        <span className="truncate">{section.label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {sections.map((section) => (
                    <TabsContent key={section.key} value={section.key} className="mt-4 flex-1">
                      {section.render()}
                    </TabsContent>
                  ))}
                </Tabs>
                {error ? (
                  <p className="text-xs text-red-200" role="alert">
                    Error: {error}
                  </p>
                ) : null}
              </CardContent>
            </PopoverContent>
          ) : null}
        </Popover>

        <Popover open={helpOpen} onOpenChange={setHelpOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full border backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                helpBaseClass,
                helpHoverClass,
                helpOpen && helpActiveClass,
              )}
              aria-label="Open help panel"
              ref={helpButtonRef}
            >
              <CircleHelp className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="top"
            sideOffset={8}
            className="w-[calc(100vw-1rem)] border border-border/60 bg-card/90 p-4 text-card-foreground shadow-card backdrop-blur sm:w-[340px]"
          >
            <HelpPanelContent />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
