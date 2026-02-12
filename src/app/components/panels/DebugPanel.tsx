import {
  defaultOscillatorSettings,
  useOscillatorSonificationStore,
} from "#src/sonification/oscillator/store";
import { IMAGE_SELECTION_KEY } from "../../state/persistenceKeys";
import { usePipelineStore } from "../../state/pipelineStore";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";

export const DebugPanel = () => {
  const uiOpacity = usePipelineStore((state) => state.uiOpacity);
  const setUiOpacity = usePipelineStore((state) => state.setUiOpacity);
  const dimLogoMark = usePipelineStore((state) => state.dimLogoMark);
  const setDimLogoMark = usePipelineStore((state) => state.setDimLogoMark);
  const resetPreferences = usePipelineStore((state) => state.resetPreferences);

  const handleResetDefaults = () => {
    resetPreferences();
    useOscillatorSonificationStore.getState().setSettings(defaultOscillatorSettings);
    usePipelineStore.persist?.clearStorage?.();
    if (typeof window !== "undefined") {
      localStorage.removeItem(IMAGE_SELECTION_KEY);
    }
  };

  // Convert 0-1 opacity to 0-100 percent for display
  const opacityPercent = Math.round(uiOpacity * 100);

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={handleResetDefaults}>
        Restore Defaults
      </Button>
      <div className="space-y-2">
        <Label>UI opacity ({opacityPercent}%)</Label>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[opacityPercent]}
          aria-label="UI opacity level"
          onValueChange={([value]) => setUiOpacity(value / 100)}
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
