import { ChevronDown, Crop, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "#src/shared/components/ui/popover";
import { Slider } from "#src/shared/components/ui/slider";
import { cn } from "#src/shared/utils/cn";
import type { HSVSamplingConfig } from "../config";
import { curatedImages } from "../data/curatedImages";
import { howItWorksImages } from "../data/howItWorksImages";
import { useImageLibrary } from "../hooks/useImageLibrary";
import type { ImageEntry } from "../types/image";

export const HSVToolbarItems = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<HSVSamplingConfig>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importDragActive, setImportDragActive] = useState(false);
  const [importActive, setImportActive] = useState(false);

  const { currentImage, uploads, handleImageFile, handleSelectImage, handleDeleteUpload } =
    useImageLibrary({
      curatedImages,
      howItWorksImages,
      selectedImageId: config.currentImageId,
      onSelectImage: async (entry) => {
        setConfig({ currentImageId: entry.id });
      },
    });

  useEffect(() => {
    if (!importActive) return;
    const handleFocus = () => setImportActive(false);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [importActive]);

  const handleImportClick = () => {
    setImportActive(true);
    inputRef.current?.click();
  };

  const handleImageInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImageFile(file);
    setImportActive(false);
    event.target.value = "";
  };

  const baseButtonClass =
    "border-border/50 bg-black/50 text-muted-foreground hover:bg-black/70 hover:text-foreground";
  const isCoverMode = config.viewportMode.kind === "cover";
  const coverMode = config.viewportMode.kind === "cover" ? config.viewportMode : null;

  return (
    <Popover>
      <PopoverAnchor asChild>
        <div className="relative flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              baseButtonClass,
              importActive && "border-white/40 bg-white/10 text-white",
            )}
            aria-label="Import image"
            onClick={handleImportClick}
          >
            <Upload className="h-4 w-4" />
          </button>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "border-border/50 bg-black/50 text-foreground/80 hover:bg-black/70 hover:text-foreground",
                "data-[state=open]:border-white/40 data-[state=open]:bg-white/10 data-[state=open]:text-white",
              )}
              title={currentImage.title}
              aria-label={`Select image: ${currentImage.title}`}
            >
              <ImageIcon className="h-4 w-4" />
              <span className="hidden truncate sm:inline sm:max-w-[140px] md:max-w-[220px]">
                {currentImage.title}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
          </PopoverTrigger>
          <button
            type="button"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              baseButtonClass,
              isCoverMode && "border-white/40 bg-white/10 text-white shadow-sm",
            )}
            aria-label="Toggle cover mode"
            aria-pressed={isCoverMode}
            onClick={() =>
              setConfig({
                viewportMode: isCoverMode
                  ? { kind: "contain" }
                  : { kind: "cover", pan: { x: 0, y: 0 }, zoom: 1 },
              })
            }
          >
            <Crop className="h-4 w-4" />
          </button>
          {coverMode && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-9 w-14 items-center justify-center rounded-full border backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "border-border/50 bg-black/50 text-foreground/80 hover:bg-black/70 hover:text-foreground",
                    "data-[state=open]:border-white/40 data-[state=open]:bg-white/10 data-[state=open]:text-white",
                    "text-xs font-semibold tabular-nums",
                  )}
                  aria-label={`Zoom: ${coverMode.zoom.toFixed(1)}x`}
                >
                  {coverMode.zoom.toFixed(1)}x
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="center"
                sideOffset={10}
                className="w-52 border border-border/60 bg-card/90 p-3 text-card-foreground shadow-card backdrop-blur"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Zoom</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {coverMode.zoom.toFixed(1)}x
                    </span>
                  </div>
                  <Slider
                    min={0.2}
                    max={10}
                    step={0.1}
                    value={[coverMode.zoom]}
                    aria-label="Zoom level"
                    onValueChange={([z]) => {
                      if (z === undefined) return;
                      setConfig({
                        viewportMode: { ...coverMode, zoom: z },
                      });
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0.2x</span>
                    <span>10x</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="center"
        sideOffset={10}
        className="max-h-[calc(var(--radix-popper-available-height)-1rem)] w-[calc(100vw-1rem)] overflow-y-auto border border-border/60 bg-card/90 p-3 text-card-foreground shadow-card backdrop-blur sm:w-[360px] [scrollbar-gutter:stable]"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                importDragActive
                  ? "border-white/40 bg-white/5 text-foreground"
                  : "border-border/60 text-muted-foreground hover:border-white/25 hover:bg-white/5",
              )}
              onClick={handleImportClick}
              onDragEnter={() => setImportDragActive(true)}
              onDragOver={(event) => {
                event.preventDefault();
                setImportDragActive(true);
              }}
              onDragLeave={() => setImportDragActive(false)}
              onDrop={async (event) => {
                event.preventDefault();
                setImportDragActive(false);
                const file = event.dataTransfer.files?.[0];
                if (!file) return;
                await handleImageFile(file);
              }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/40">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Drop image here</p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
              </div>
            </button>
          </div>

          <div className="space-y-1.5">
            {howItWorksImages.map((entry) => (
              <ImageRow
                key={entry.id}
                entry={entry}
                isActive={currentImage.id === entry.id}
                onSelect={() => void handleSelectImage(entry)}
              />
            ))}
          </div>

          <div className="space-y-1.5">
            {curatedImages.map((entry) => (
              <ImageRow
                key={entry.id}
                entry={entry}
                isActive={currentImage.id === entry.id}
                onSelect={() => void handleSelectImage(entry)}
              />
            ))}
          </div>

          <div className="space-y-1.5">
            {uploads.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                No cached uploads yet.
              </p>
            ) : (
              uploads.map((entry) => (
                <div key={entry.id} className="relative">
                  <ImageRow
                    entry={entry}
                    isActive={currentImage.id === entry.id}
                    onSelect={() => void handleSelectImage(entry)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-white/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={`Remove ${entry.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteUpload(entry);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Choose image file"
        onChange={handleImageInput}
      />
    </Popover>
  );
};

const ImageRow = ({
  entry,
  isActive,
  onSelect,
  className,
}: {
  entry: ImageEntry;
  isActive: boolean;
  onSelect: () => void;
  className?: string;
}) => (
  <button
    type="button"
    aria-current={isActive ? "true" : undefined}
    className={cn(
      "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      isActive
        ? "border-white/35 bg-white/5"
        : "border-transparent hover:border-white/20 hover:bg-white/5",
      className,
    )}
    onClick={onSelect}
  >
    <img
      src={entry.previewSrc}
      alt={entry.title}
      className="h-10 w-10 rounded-md object-cover"
      loading="lazy"
    />
    <div>
      <p className="text-sm font-medium text-foreground">{entry.title}</p>
      <p className="text-xs text-muted-foreground">{entry.meta}</p>
    </div>
  </button>
);
