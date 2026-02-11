/**
 * @deprecated This file is deprecated. Detection plugin settings are now provided
 * by the plugin itself. See src/detection/mediapipe/components/SettingsPanel.tsx
 * for the MediaPipe detection plugin's settings panel.
 *
 * This file remains for historical reference only and should not be imported.
 */

import { useMediaPipeDetectionStore } from "#src/detection/mediapipe/store";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";

/**
 * @deprecated Use detection plugin's SettingsPanel instead
 */
export const InputPanel = () => {
  const mirror = useMediaPipeDetectionStore((state) => state.mirror);
  const setMirror = useMediaPipeDetectionStore((state) => state.setMirror);
  const maxHands = useMediaPipeDetectionStore((state) => state.maxHands);
  const setMaxHands = useMediaPipeDetectionStore((state) => state.setMaxHands);
  const facingMode = useMediaPipeDetectionStore((state) => state.facingMode);
  const setFacingMode = useMediaPipeDetectionStore((state) => state.setFacingMode);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="max-hands">Tracked hands ({maxHands})</Label>
        <Slider
          id="max-hands"
          min={1}
          max={4}
          step={1}
          value={[maxHands]}
          aria-label="Tracked hands"
          onValueChange={([value]) => setMaxHands(value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="camera-facing">Active camera</Label>
        <Select
          value={facingMode}
          onValueChange={(value) => setFacingMode(value as "user" | "environment")}
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
        <Switch id="mirror-toggle" checked={mirror} onCheckedChange={setMirror} />
      </div>
    </div>
  );
};
