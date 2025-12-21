import { useEffect, useMemo, useRef } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

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
  const tabRefs = useRef(new Map<K, HTMLButtonElement>());
  const panelId = "herakoi-controls-panel";

  const defaultKey = useMemo(() => {
    const cameraKey = sections.find((section) => section.key === ("camera" as K))?.key;
    return cameraKey ?? sections[0]?.key ?? null;
  }, [sections]);

  useEffect(() => {
    if (!openSection) return;
    const active = tabRefs.current.get(openSection);
    if (!active) return;
    requestAnimationFrame(() => active.focus());
  }, [openSection]);

  const handleSectionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!openSection) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = (index + 1) % sections.length;
      const nextKey = sections[next]?.key;
      if (!nextKey) return;
      setOpenSection(nextKey);
      tabRefs.current.get(nextKey)?.focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prev = (index - 1 + sections.length) % sections.length;
      const prevKey = sections[prev]?.key;
      if (!prevKey) return;
      setOpenSection(prevKey);
      tabRefs.current.get(prevKey)?.focus();
    }
  };

  const activeSection: ControlPanelSection<K> | null = openSection
    ? (sections.find((section) => section.key === openSection) ?? null)
    : null;

  return (
    <div className="fixed bottom-4 right-4 z-10 flex flex-col items-end gap-2">
      <div className="relative flex flex-col items-end">
        <Button
          variant="ghost"
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur border",
            openSection
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-border/50 bg-black/50 text-muted-foreground",
          )}
          onClick={() => setOpenSection(openSection ? null : defaultKey)}
          aria-expanded={Boolean(openSection)}
          aria-controls={panelId}
          aria-label="Toggle controls panel"
          tabIndex={0}
          style={{ position: "relative", zIndex: 2 }}
        >
          Controls
        </Button>
        {openSection ? (
          <Card
            className="w-[320px]"
            id={panelId}
            style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0 }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                {activeSection?.title ?? activeSection?.label ?? "Controls"}
                <StatusBadge status={status} />
              </CardTitle>
              <CardDescription>Tap chip to collapse. Switch sections below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Control sections">
                {sections.map((section, index) => (
                  <Button
                    key={section.key}
                    variant="outline"
                    size="sm"
                    role="tab"
                    aria-selected={openSection === section.key}
                    tabIndex={openSection === section.key ? 0 : -1}
                    ref={(element) => {
                      if (element) {
                        tabRefs.current.set(section.key, element);
                      } else {
                        tabRefs.current.delete(section.key);
                      }
                    }}
                    onClick={() => setOpenSection(section.key)}
                    onKeyDown={(event) => handleSectionKeyDown(event, index)}
                  >
                    {section.label}
                  </Button>
                ))}
              </div>
              {activeSection?.render() ?? null}
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
          </Card>
        ) : null}
      </div>
    </div>
  );
};
