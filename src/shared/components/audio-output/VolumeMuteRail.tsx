import { VolumeX } from "lucide-react";
import { Button } from "#src/shared/components/ui/button";
import { Label } from "#src/shared/components/ui/label";
import { Slider } from "#src/shared/components/ui/slider";
import { cn } from "#src/shared/utils/cn";

type VolumeMuteRailProps = {
  volume: number;
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onMutedChange: (muted: boolean) => void;
  className?: string;
};

export const VolumeMuteRail = ({
  volume,
  muted,
  onVolumeChange,
  onMutedChange,
  className,
}: VolumeMuteRailProps) => {
  const volumePercent = Math.round(volume * 100);

  return (
    <div className={cn("flex h-full flex-col items-center", className)}>
      <div className="flex flex-1 flex-col items-center justify-center">
        <Label className="sr-only">Master volume</Label>
        <div className="h-[150px]">
          <Slider
            orientation="vertical"
            min={0}
            max={100}
            step={1}
            value={[volumePercent]}
            aria-label="Master volume"
            thumbLabels={["Master volume"]}
            onValueChange={([value]) => onVolumeChange(value / 100)}
          />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onMutedChange(!muted)}
        className={cn(
          "h-8 w-8 rounded-full border border-white/15 bg-black/30 text-white/70 hover:bg-black/50 hover:text-white",
          muted && "border-white/40 text-white",
        )}
        aria-pressed={muted}
        aria-label={muted ? "Unmute sonification" : "Mute sonification"}
      >
        <VolumeX className="h-4 w-4" />
      </Button>
    </div>
  );
};
