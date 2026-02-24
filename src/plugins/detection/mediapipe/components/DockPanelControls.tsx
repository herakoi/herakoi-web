import { Camera, RefreshCw } from "lucide-react";
import { Button } from "#src/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import { cn } from "#src/shared/utils/cn";
import type { DeviceInfo } from "../NativeCamera";

type DockPanelControlsProps = {
  pipOpen: boolean;
  deviceId: string;
  devices: DeviceInfo[];
  restartCamera: (() => Promise<void>) | null;
  onTogglePip: () => void;
  onDeviceChange: (deviceId: string) => void;
};

function deviceLabel(device: DeviceInfo): string {
  if (device.facingMode === "user") return "Front";
  if (device.facingMode === "environment") return "Rear";
  return device.label;
}

export const DockPanelControls = ({
  pipOpen,
  deviceId,
  devices,
  restartCamera,
  onTogglePip,
  onDeviceChange,
}: DockPanelControlsProps) => {
  const cameraBaseClass = "border-border/50 bg-black/50 text-muted-foreground";
  const cameraHoverClass = "hover:bg-black/70 hover:text-foreground";
  const cameraActiveClass = "border-white/40 bg-white/10 text-white";
  const selectBaseClass = "border-border/50 bg-black/50 text-muted-foreground";
  const selectHoverClass = "hover:bg-black/70 hover:text-foreground";
  const selectOpenClass =
    "data-[state=open]:border-white/40 data-[state=open]:bg-white/10 data-[state=open]:text-white";

  const activeDevice = devices.find((d) => d.deviceId === deviceId) ?? devices[0] ?? null;
  const activePlaceholder = activeDevice ? deviceLabel(activeDevice) : "Camera";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Button
        variant="ghost"
        className={cn(
          "h-9 w-9 rounded-full border p-0 backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          cameraBaseClass,
          cameraHoverClass,
          pipOpen && cameraActiveClass,
        )}
        aria-pressed={pipOpen}
        aria-label={pipOpen ? "Hide picture in picture" : "Show picture in picture"}
        onClick={onTogglePip}
      >
        <Camera className="h-4 w-4" />
      </Button>
      {devices.length > 0 ? (
        <Select value={deviceId || ""} onValueChange={onDeviceChange}>
          <SelectTrigger
            aria-label="Active camera"
            className={cn(
              "h-9 w-[100px] rounded-full border px-3 text-xs font-semibold uppercase tracking-wide backdrop-blur sm:w-[150px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selectBaseClass,
              selectHoverClass,
              selectOpenClass,
            )}
          >
            <span className="min-w-0 truncate">
              <SelectValue placeholder={activePlaceholder} />
            </span>
          </SelectTrigger>
          <SelectContent>
            {devices.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {deviceLabel(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Select disabled>
          <SelectTrigger
            aria-label="Active camera"
            className={cn(
              "h-9 w-[100px] rounded-full border px-3 text-xs font-semibold uppercase tracking-wide backdrop-blur sm:w-[150px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selectBaseClass,
              selectHoverClass,
              selectOpenClass,
            )}
          >
            <span className="min-w-0 truncate">
              <SelectValue placeholder={activePlaceholder} />
            </span>
          </SelectTrigger>
          <SelectContent />
        </Select>
      )}
      {restartCamera && (
        <Button
          variant="ghost"
          className={cn(
            "h-9 w-9 rounded-full border p-0 backdrop-blur",
            cameraBaseClass,
            cameraHoverClass,
          )}
          aria-label="Refresh camera"
          onClick={() => void restartCamera()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};
