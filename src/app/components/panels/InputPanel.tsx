import { usePipelineStore } from "../../state/pipelineStore";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";

export const InputPanel = () => {
  const mirror = usePipelineStore((state) => state.mirror);
  const setMirror = usePipelineStore((state) => state.setMirror);
  const maxHands = usePipelineStore((state) => state.maxHands);
  const setMaxHands = usePipelineStore((state) => state.setMaxHands);
  const facingMode = usePipelineStore((state) => state.facingMode);
  const setFacingMode = usePipelineStore((state) => state.setFacingMode);

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
