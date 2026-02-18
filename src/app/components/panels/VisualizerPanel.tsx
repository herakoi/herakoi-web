import type { VisualizationPlugin } from "#src/core/plugin";
import { useActivePlugin, useAppConfigStore, useUiPreferences } from "../../state/appConfigStore";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";

type VisualizerPanelProps = {
  visualizers: VisualizationPlugin[];
};

export const VisualizerPanel = ({ visualizers }: VisualizerPanelProps) => {
  const [activeVisualizerId, setActiveVisualizerId] = useActivePlugin("visualization");
  const [uiPrefs, setUiPrefs] = useUiPreferences();
  const resetAll = useAppConfigStore((s) => s.resetAll);

  const handleResetDefaults = () => {
    // Reset EVERYTHING: activePlugins, pluginConfigs, uiPreferences
    resetAll();
  };

  const opacityPercent = Math.round(uiPrefs.baseUiOpacity * 100);

  return (
    <div className="space-y-4">
      {/* Visualizer selector */}
      <div className="space-y-2">
        <Label>Active Visualizer</Label>
        <Select
          value={activeVisualizerId ?? "none"}
          onValueChange={(value) => {
            setActiveVisualizerId(value === "none" ? null : value);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select visualizer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {visualizers.map((plugin) => (
              <SelectItem key={plugin.id} value={plugin.id}>
                {plugin.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Render settings panel for active visualizer if it has one */}
      {activeVisualizerId &&
        (() => {
          const activePlugin = visualizers.find((p) => p.id === activeVisualizerId);
          const SettingsPanel = activePlugin?.ui.SettingsPanel;
          return SettingsPanel ? <SettingsPanel /> : null;
        })()}

      {/* Preferences (moved from separate tab) */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-medium">Preferences</h3>
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
            onValueChange={([value]) => setUiPrefs({ baseUiOpacity: value / 100 })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-medium" htmlFor="dim-logo-mark">
            Dim logo mark on idle
          </Label>
          <Switch
            id="dim-logo-mark"
            checked={uiPrefs.dimLogoMark}
            onCheckedChange={(checked) => setUiPrefs({ dimLogoMark: checked })}
          />
        </div>
      </div>
    </div>
  );
};
