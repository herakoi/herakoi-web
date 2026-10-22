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
import { useErrorText } from "#src/shared/i18n";
import { cn } from "#src/shared/utils/cn";
import { type HSVSamplingConfig, hsvSamplingPluginId } from "../config";
import { curatedImages } from "../data/curatedImages";
import { howItWorksImages } from "../data/howItWorksImages";
import { useImageLibrary } from "../hooks/useImageLibrary";
import { useT } from "../i18n";
import { useHSVRuntimeStore } from "../runtimeStore";
import type { ImageEntry } from "../types/image";

export const HSVSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<HSVSamplingConfig>) => {
  const t = useT();
  const errorText = useErrorText(hsvSamplingPluginId);
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
        <SelectTrigger id="active-image" aria-label={t("settings.activeImage")}>
          <SelectValue placeholder={t("settings.activeImage")} />
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
        <Label className="text-sm font-medium" htmlFor="pan-toggle">
          {t("settings.enablePan")}
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
        aria-label={t("upload.dropOrBrowse")}
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
        <div className="text-sm font-medium text-foreground">{t("upload.dropHere")}</div>
        <div className="text-xs text-muted-foreground">{t("upload.orBrowse")}</div>
      </button>
      <Input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={t("upload.chooseFile")}
        onChange={handleFile}
      />
      {imageLibraryStatus.status === "error" ? (
        <p className="text-xs text-red-300" role="alert">
          {errorText(imageLibraryStatus.error)}
        </p>
      ) : null}
    </div>
  );
};
