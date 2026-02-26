import { Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { Input } from "#src/shared/components/ui/input";
import { Label } from "#src/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import { Switch } from "#src/shared/components/ui/switch";
import { cn } from "#src/shared/utils/cn";
import type { HSVSamplingConfig } from "../config";
import { curatedImages } from "../data/curatedImages";
import { howItWorksImages } from "../data/howItWorksImages";
import { useImageLibrary } from "../hooks/useImageLibrary";
import { useHSVRuntimeStore } from "../runtimeStore";
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
    selectedImageId: config.currentImageId,
    onSelectImage: async (entry) => {
      setConfig({ currentImageId: entry.id });
    },
  });
  const imageLibraryStatus = useHSVRuntimeStore((state) => state.imageLibraryStatus);
  const viewportMode = useHSVRuntimeStore((state) => state.viewportMode);
  const panInteractionEnabled = useHSVRuntimeStore((state) => state.panInteractionEnabled);
  const setViewportMode = useHSVRuntimeStore((state) => state.setViewportMode);
  const setPanInteractionEnabled = useHSVRuntimeStore((state) => state.setPanInteractionEnabled);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImageFile(file);
  };
  const isCoverMode = viewportMode.kind === "cover";
  const isPanEnabled = panInteractionEnabled;

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
          checked={isCoverMode}
          onCheckedChange={(checked) => {
            if (checked) {
              if (!isCoverMode) {
                setViewportMode({ kind: "cover", pan: { x: 0, y: 0 }, zoom: 1, rotation: 0 });
              }
              return;
            }
            setViewportMode({ kind: "contain" });
            setPanInteractionEnabled(false);
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium" htmlFor="pan-toggle">
          Enable pan gesture
        </Label>
        <Switch
          id="pan-toggle"
          checked={isPanEnabled}
          disabled={!isCoverMode}
          onCheckedChange={setPanInteractionEnabled}
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
      {imageLibraryStatus.status === "error" ? (
        <p className="text-xs text-red-300" role="alert">
          {imageLibraryStatus.error.message}
        </p>
      ) : null}
    </div>
  );
};
