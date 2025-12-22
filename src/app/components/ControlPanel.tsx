import { useMemo } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    running: "bg-green-500/20 text-green-200 border border-green-500/50",
    initializing: "bg-amber-500/20 text-amber-100 border border-amber-500/40",
    idle: "bg-slate-500/20 text-slate-100 border border-slate-500/50",
    error: "bg-red-500/20 text-red-100 border border-red-500/50",
  };
  const className = styles[status] ?? styles.idle;
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${className}`}
    >
      {status}
    </span>
  );
};

export type ControlPanelSection<K extends string = string> = {
  key: K;
  label: string;
  title?: string;
  render: () => React.ReactNode;
};

type ControlPanelProps<K extends string> = {
  status: string;
  error: string | null;
  openSection: K | null;
  setOpenSection: React.Dispatch<React.SetStateAction<K | null>>;
  sections: ControlPanelSection<K>[];
  onRestart: () => void;
  onStop: () => void;
};

export const ControlPanel = <K extends string>({
  status,
  error,
  openSection,
  setOpenSection,
  sections,
  onRestart,
  onStop,
}: ControlPanelProps<K>) => {
  const defaultKey = useMemo(() => {
    const cameraKey = sections.find((section) => section.key === ("camera" as K))?.key;
    return cameraKey ?? sections[0]?.key ?? null;
  }, [sections]);

  const activeSection: ControlPanelSection<K> | null = openSection
    ? (sections.find((section) => section.key === openSection) ?? null)
    : null;
  const open = Boolean(openSection);
  const value = openSection ?? defaultKey;

  return (
    <div className="fixed bottom-4 right-4 z-10 flex flex-col items-end gap-2">
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
              "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur border",
              open
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/50 bg-black/50 text-muted-foreground",
            )}
            aria-label="Toggle controls panel"
            tabIndex={0}
          >
            Controls
          </Button>
        </PopoverTrigger>
        {defaultKey && value ? (
          <PopoverContent
            align="end"
            side="top"
            sideOffset={8}
            className="w-[320px] border border-border/60 bg-card/80 p-0 text-card-foreground shadow-card backdrop-blur"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                {activeSection?.title ?? activeSection?.label ?? "Controls"}
                <StatusBadge status={status} />
              </CardTitle>
              <CardDescription>Tap chip to collapse. Switch sections below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Tabs value={value} onValueChange={(nextValue) => setOpenSection(nextValue as K)}>
                <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0">
                  {sections.map((section) => (
                    <TabsTrigger
                      key={section.key}
                      value={section.key}
                      className="w-full border border-input bg-background text-foreground shadow-outline data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                    >
                      {section.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {sections.map((section) => (
                  <TabsContent key={section.key} value={section.key} className="mt-3">
                    {section.render()}
                  </TabsContent>
                ))}
              </Tabs>
              <div className="mt-3 flex items-center gap-3">
                <Button className="flex-1" variant="outline" onClick={onRestart}>
                  Restart
                </Button>
                <Button className="flex-1" variant="ghost" onClick={onStop}>
                  Stop
                </Button>
              </div>
              {error ? <p className="text-xs text-red-200">Error: {error}</p> : null}
            </CardContent>
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  );
};
