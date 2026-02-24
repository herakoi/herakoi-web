import { RefreshCw } from "lucide-react";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { Button } from "#src/shared/components/ui/button";
import { Label } from "#src/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import { Slider } from "#src/shared/components/ui/slider";
import { Switch } from "#src/shared/components/ui/switch";
import type { MediaPipeConfig } from "../config";
import { useDeviceStore } from "../deviceStore";

function deviceLabel(device: { label: string; facingMode?: string }): string {
  if (device.facingMode === "user") return "Frontale";
  if (device.facingMode === "environment") return "Posteriore";
  return device.label;
}

export const MediaPipeSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<MediaPipeConfig>) => {
  const devices = useDeviceStore((s) => s.devices);
  const restartCamera = useDeviceStore((s) => s.restartCamera);

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
        <Label htmlFor="camera-device">Active camera</Label>
        <div className="flex items-center gap-1.5">
          {devices.length > 0 ? (
            <Select
              value={config.deviceId || ""}
              onValueChange={(value) => setConfig({ deviceId: value })}
            >
              <SelectTrigger id="camera-device" className="flex-1" aria-label="Active camera">
                <SelectValue placeholder="Default camera" />
              </SelectTrigger>
              <SelectContent position="popper">
                {devices.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {deviceLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select disabled>
              <SelectTrigger id="camera-device" className="flex-1" aria-label="Active camera">
                <SelectValue placeholder="Start to select camera" />
              </SelectTrigger>
              <SelectContent position="popper" />
            </Select>
          )}
          {restartCamera && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Refresh camera"
              onClick={() => void restartCamera()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
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
