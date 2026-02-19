import { Camera } from "lucide-react";
import { Button } from "#src/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import { cn } from "#src/shared/utils/cn";

type DockPanelControlsProps = {
  pipOpen: boolean;
  facingMode: "user" | "environment";
  onTogglePip: () => void;
  onFacingModeChange: (value: "user" | "environment") => void;
};

export const DockPanelControls = ({
  pipOpen,
  facingMode,
  onTogglePip,
  onFacingModeChange,
}: DockPanelControlsProps) => {
  const cameraBaseClass = "border-border/50 bg-black/50 text-muted-foreground";
  const cameraHoverClass = "hover:bg-black/70 hover:text-foreground";
  const cameraActiveClass = "border-white/40 bg-white/10 text-white";
  const selectBaseClass = "border-border/50 bg-black/50 text-muted-foreground";
  const selectHoverClass = "hover:bg-black/70 hover:text-foreground";
  const selectOpenClass =
    "data-[state=open]:border-white/40 data-[state=open]:bg-white/10 data-[state=open]:text-white";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Button
        variant="ghost"
        className={cn(
          "rounded-full backdrop-blur border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "h-9 w-9 p-0 sm:h-auto sm:w-auto sm:px-4 sm:py-2",
          "text-xs font-semibold uppercase tracking-wide",
          cameraBaseClass,
          cameraHoverClass,
          pipOpen && cameraActiveClass,
        )}
        aria-pressed={pipOpen}
        aria-label={pipOpen ? "Hide picture in picture" : "Show picture in picture"}
        onClick={onTogglePip}
      >
        <Camera className="h-4 w-4 sm:hidden" />
        <span className="hidden sm:inline">Camera</span>
      </Button>
      <Select
        value={facingMode}
        onValueChange={(value) => onFacingModeChange(value as "user" | "environment")}
      >
        <SelectTrigger
          aria-label="Camera facing"
          className={cn(
            "h-9 w-[100px] rounded-full border px-3 text-xs font-semibold uppercase tracking-wide backdrop-blur sm:w-[150px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            selectBaseClass,
            selectHoverClass,
            selectOpenClass,
          )}
        >
          <SelectValue placeholder="Camera" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="user">Front</SelectItem>
          <SelectItem value="environment">Rear</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
