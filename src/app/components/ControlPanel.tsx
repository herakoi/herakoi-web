import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import { cn } from "../lib/utils";
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
};

export const ControlPanel = <K extends string>({
  error,
  className,
  style,
  openSection,
  setOpenSection,
  sections,
}: ControlPanelProps<K>) => {
  const defaultKey = useMemo(() => {
    return sections[0]?.key ?? null;
  }, [sections]);

  const open = Boolean(openSection);
  const value = openSection ?? defaultKey;

  return (
    <div
      className={cn("fixed bottom-4 right-4 z-10 flex flex-col items-end gap-2", className)}
      style={style}
    >
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
              "gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur border",
              open
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/50 bg-black/50 text-muted-foreground",
            )}
            aria-label="Toggle controls panel"
            tabIndex={0}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Settings</span>
          </Button>
        </PopoverTrigger>
        {defaultKey && value ? (
          <PopoverContent
            align="end"
            side="top"
            sideOffset={8}
            className="h-[290px] w-[400px] border border-border/60 bg-card/80 p-0 text-card-foreground shadow-card backdrop-blur"
          >
            <CardContent className="flex h-full flex-col gap-3 pt-4">
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
                      className="flex items-center justify-center gap-1.5 rounded-full border border-transparent px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60 transition data-[state=active]:border-white/40 data-[state=active]:bg-white/25 data-[state=active]:text-white data-[state=active]:shadow-outline"
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
              {error ? <p className="text-xs text-red-200">Error: {error}</p> : null}
            </CardContent>
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  );
};
