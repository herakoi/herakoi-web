import { ChevronDown, Crop, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, type RefObject, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type { ImageEntry } from "../../types/image";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../ui/popover";

type CurrentImage = {
  id: string;
  title: string;
};

type ImageToolbarProps = {
  currentImage: CurrentImage;
  howItWorksImages: ImageEntry[];
  curatedImages: ImageEntry[];
  uploads: ImageEntry[];
  imageCover: boolean;
  coverTone: "light" | "dark";
  importTone: "light" | "dark";
  imageTone: "light" | "dark";
  onToggleCover: () => void;
  onFile: (file: File) => Promise<void>;
  onSelectImage: (entry: ImageEntry) => Promise<void>;
  onDeleteUpload: (entry: ImageEntry) => void;
  coverButtonRef: RefObject<HTMLButtonElement>;
  importButtonRef: RefObject<HTMLButtonElement>;
  imageButtonRef: RefObject<HTMLButtonElement>;
};

export const ImageToolbar = ({
  currentImage,
  howItWorksImages,
  curatedImages,
  uploads,
  imageCover,
  coverTone,
  importTone,
  imageTone,
  onToggleCover,
  onFile,
  onSelectImage,
  onDeleteUpload,
  coverButtonRef,
  importButtonRef,
  imageButtonRef,
}: ImageToolbarProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importDragActive, setImportDragActive] = useState(false);
  const [importActive, setImportActive] = useState(false);

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
    await onFile(file);
    setImportActive(false);
    event.target.value = "";
  };

  const importBaseClass =
    importTone === "dark"
      ? "border-black/30 bg-black/40 text-white/90"
      : "border-border/50 bg-black/50 text-muted-foreground";
  const importHoverClass =
    importTone === "dark"
      ? "hover:bg-black/55 hover:text-white"
      : "hover:bg-black/70 hover:text-foreground";
  const importActiveClass =
    importTone === "dark"
      ? "border-black/50 bg-black/70 text-white"
      : "border-white/40 bg-white/10 text-white";
  const imageBaseClass =
    imageTone === "dark"
      ? "border-black/30 bg-black/40 text-white/90"
      : "border-border/50 bg-black/50 text-foreground/80";
  const imageHoverClass =
    imageTone === "dark"
      ? "hover:bg-black/55 hover:text-white"
      : "hover:bg-black/70 hover:text-foreground";
  const imageOpenClass =
    imageTone === "dark"
      ? "data-[state=open]:border-black/50 data-[state=open]:bg-black/70 data-[state=open]:text-white"
      : "data-[state=open]:border-white/40 data-[state=open]:bg-white/10 data-[state=open]:text-white";
  const coverBaseClass =
    coverTone === "dark"
      ? "border-black/30 bg-black/40 text-white/90"
      : "border-border/50 bg-black/50 text-muted-foreground";
  const coverHoverClass =
    coverTone === "dark"
      ? "hover:bg-black/55 hover:text-white"
      : "hover:bg-black/70 hover:text-foreground";
  const coverActiveClass =
    coverTone === "dark"
      ? "border-black/50 bg-black/70 text-white shadow-sm"
      : "border-white/40 bg-white/10 text-white";

  return (
    <Popover>
      <PopoverAnchor asChild>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition",
              importBaseClass,
              importHoverClass,
              importActive && importActiveClass,
            )}
            aria-label="Import image"
            onClick={handleImportClick}
            ref={importButtonRef}
          >
            <Upload className="h-4 w-4" />
          </button>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur transition",
                imageBaseClass,
                imageHoverClass,
                imageOpenClass,
              )}
              title={currentImage.title}
              ref={imageButtonRef}
            >
              <ImageIcon className="h-4 w-4" />
              <span className="max-w-[220px] truncate">{currentImage.title}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
          </PopoverTrigger>
          <button
            type="button"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition",
              coverBaseClass,
              coverHoverClass,
              imageCover && coverActiveClass,
            )}
            aria-label="Toggle cover mode"
            aria-pressed={imageCover}
            onClick={onToggleCover}
            ref={coverButtonRef}
          >
            <Crop className="h-4 w-4" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="center"
        sideOffset={10}
        className="max-h-[calc(var(--radix-popper-available-height)-1rem)] w-[360px] overflow-y-auto border border-border/60 bg-card/90 p-3 text-card-foreground shadow-card backdrop-blur [scrollbar-gutter:stable]"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-left text-sm transition",
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
                await onFile(file);
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
              <button
                key={entry.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
                  currentImage.id === entry.id
                    ? "border-white/35 bg-white/5"
                    : "border-transparent hover:border-white/20 hover:bg-white/5",
                )}
                onClick={() => void onSelectImage(entry)}
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
            ))}
          </div>

          <div className="space-y-1.5">
            {curatedImages.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
                  currentImage.id === entry.id
                    ? "border-white/35 bg-white/5"
                    : "border-transparent hover:border-white/20 hover:bg-white/5",
                )}
                onClick={() => void onSelectImage(entry)}
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
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2 pr-10 text-left transition",
                      currentImage.id === entry.id
                        ? "border-white/35 bg-white/5"
                        : "border-transparent hover:border-white/20 hover:bg-white/5",
                    )}
                    onClick={() => void onSelectImage(entry)}
                  >
                    <img
                      src={entry.previewSrc}
                      alt={entry.title}
                      className="h-10 w-10 rounded-md object-cover"
                      loading="lazy"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{entry.title}</p>
                      <p className="text-xs text-muted-foreground">{entry.meta}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-white/25 hover:text-foreground"
                    aria-label={`Remove ${entry.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteUpload(entry);
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
        onChange={handleImageInput}
      />
    </Popover>
  );
};
