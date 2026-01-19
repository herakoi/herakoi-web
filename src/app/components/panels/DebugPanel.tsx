import { useState } from "react";
import { IMAGE_SELECTION_KEY } from "../../state/persistenceKeys";
import { usePipelineStore } from "../../state/pipelineStore";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";

export const DebugPanel = () => {
  const uiDimPercent = usePipelineStore((state) => state.uiDimPercent);
  const setUiDimPercent = usePipelineStore((state) => state.setUiDimPercent);
  const dimLogoMark = usePipelineStore((state) => state.dimLogoMark);
  const setDimLogoMark = usePipelineStore((state) => state.setDimLogoMark);
  const resetPreferences = usePipelineStore((state) => state.resetPreferences);
  const [debugEnabled, setDebugEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.has("dev");
  });

  const handleDebug = () => {
    const nextUrl = new URL(window.location.href);
    const willEnable = !debugEnabled;
    if (willEnable) {
      nextUrl.searchParams.set("dev", "1");
    } else {
      nextUrl.searchParams.delete("dev");
    }
    window.history.replaceState({}, "", nextUrl.toString());
    setDebugEnabled(willEnable);
    window.dispatchEvent(new Event("herakoi-debug-toggle"));
  };

  const handleResetDefaults = () => {
    resetPreferences();
    usePipelineStore.persist?.clearStorage?.();
    if (typeof window !== "undefined") {
      localStorage.removeItem(IMAGE_SELECTION_KEY);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant={debugEnabled ? "secondary" : "outline"} onClick={handleDebug}>
        {debugEnabled ? "Disable Dev HUD" : "Enable Dev HUD"}
      </Button>
      <Button variant="outline" onClick={handleResetDefaults}>
        Restore Defaults
      </Button>
      <div className="space-y-2">
        <Label>UI dim level ({uiDimPercent}%)</Label>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[uiDimPercent]}
          aria-label="UI dim level"
          onValueChange={([value]) => setUiDimPercent(value)}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium" htmlFor="dim-logo-mark">
          Dim logo mark on idle
        </Label>
        <Switch id="dim-logo-mark" checked={dimLogoMark} onCheckedChange={setDimLogoMark} />
      </div>
    </div>
  );
};
