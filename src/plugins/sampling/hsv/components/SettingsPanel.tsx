import { Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { Input } from "#src/components/ui/input";
import { Label } from "#src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/components/ui/select";
import { Switch } from "#src/components/ui/switch";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { cn } from "#src/lib/utils";
import type { HSVSamplingConfig } from "../config";
import { curatedImages } from "../data/curatedImages";
import { howItWorksImages } from "../data/howItWorksImages";
import { useImageLibrary } from "../hooks/useImageLibrary";
import type { ImageEntry } from "../types/image";

export const HSVSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<HSVSamplingConfig>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const { currentImage, entries, handleImageFile, handleSelectImage } = useImageLibrary({
    curatedImages,
    howItWorksImages,
    onSelectImage: async (entry) => {
      setConfig({ currentImageId: entry.id });
    },
  });

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImageFile(file);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <Select
        value={currentImage.id}
        onValueChange={(value) => {
          const entry = entries.find((item: ImageEntry) => item.id === value);
          if (!entry) return;
          void handleSelectImage(entry);
        }}
      >
        <SelectTrigger id="active-image" aria-label="Active image">
          <SelectValue placeholder="Active image" />
        </SelectTrigger>
        <SelectContent>
          {entries.map((entry: ImageEntry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {entry.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium" htmlFor="cover-toggle">
          Cover image
        </Label>
        <Switch
          id="cover-toggle"
          checked={config.imageCover}
          onCheckedChange={(checked) => setConfig({ imageCover: checked })}
        />
      </div>
      <button
        type="button"
        aria-label="Upload image: drop here or click to browse"
        className={cn(
          "flex w-full flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground transition",
          dragActive
            ? "border-white/40 bg-white/5 text-foreground"
            : "border-border/60 hover:border-white/20 hover:bg-white/5",
        )}
        onClick={() => inputRef.current?.click()}
        onDragEnter={() => setDragActive(true)}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (!file) return;
          await handleImageFile(file);
        }}
      >
        <Upload className="h-4 w-4" />
        <div className="text-sm font-medium text-foreground">Drop image here</div>
        <div className="text-xs text-muted-foreground">or click to browse</div>
      </button>
      <Input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Choose image file"
        onChange={handleFile}
      />
    </div>
  );
};
