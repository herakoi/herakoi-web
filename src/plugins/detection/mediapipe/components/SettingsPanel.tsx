import { Label } from "#src/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/app/components/ui/select";
import { Slider } from "#src/app/components/ui/slider";
import { Switch } from "#src/app/components/ui/switch";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import type { MediaPipeConfig } from "../config";

export const MediaPipeSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<MediaPipeConfig>) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="max-hands">Tracked hands ({config.maxHands})</Label>
        <Slider
          id="max-hands"
          min={1}
          max={4}
          step={1}
          value={[config.maxHands]}
          aria-label="Tracked hands"
          onValueChange={([value]) => setConfig({ maxHands: value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="camera-facing">Active camera</Label>
        <Select
          value={config.facingMode}
          onValueChange={(value) => setConfig({ facingMode: value as "user" | "environment" })}
        >
          <SelectTrigger id="camera-facing" aria-label="Active camera">
            <SelectValue placeholder="Choose camera" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="user">Front (user)</SelectItem>
            <SelectItem value="environment">Rear (environment)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium" htmlFor="mirror-toggle">
          Mirror camera
        </Label>
        <Switch
          id="mirror-toggle"
          checked={config.mirror}
          onCheckedChange={(checked) => setConfig({ mirror: checked })}
        />
      </div>
    </div>
  );
};
