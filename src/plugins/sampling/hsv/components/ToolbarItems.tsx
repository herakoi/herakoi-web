import { clsx } from "clsx";
import { ChevronDown, Image as ImageIcon, Move, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "#src/shared/components/ui/popover";
import { Slider } from "#src/shared/components/ui/slider";
import { useErrorText } from "#src/shared/i18n";
import glass from "#src/shared/styles/glass.module.css";
import { type HSVSamplingConfig, hsvSamplingPluginId } from "../config";
import { curatedImages } from "../data/curatedImages";
import { howItWorksImages } from "../data/howItWorksImages";
import { useImageLibrary } from "../hooks/useImageLibrary";
import { useLocalizeImageEntry, useT } from "../i18n";
import { useHSVRuntimeStore } from "../runtimeStore";
import type { ImageEntry } from "../types/image";
import styles from "./ToolbarItems.module.css";

export const HSVToolbarItems = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<HSVSamplingConfig>) => {
  const t = useT();
  const errorText = useErrorText(hsvSamplingPluginId);
  const localizeEntry = useLocalizeImageEntry();
  const inputRef = useRef<HTMLInputElement>(null);
  const moveHintId = useId();
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
  const imageLibraryStatus = useHSVRuntimeStore((state) => state.imageLibraryStatus);
  const viewportMode = useHSVRuntimeStore((state) => state.viewportMode);
  const panInteractionEnabled = useHSVRuntimeStore((state) => state.panInteractionEnabled);
  const setViewportMode = useHSVRuntimeStore((state) => state.setViewportMode);
  const setPanInteractionEnabled = useHSVRuntimeStore((state) => state.setPanInteractionEnabled);

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

  const isCoverMode = viewportMode.kind === "cover";
  const isPanEnabled = panInteractionEnabled;
  const coverMode = viewportMode.kind === "cover" ? viewportMode : null;

  return (
    <Popover>
      <PopoverAnchor asChild>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={clsx(styles.importButton, glass.button, importActive && glass.active)}
            aria-label={t("toolbar.importImage")}
            onClick={handleImportClick}
          >
            <Upload className={styles.icon} />
          </button>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={styles.imageTrigger}
              title={currentImage.title}
              aria-label={t("toolbar.selectImage", { title: currentImage.title })}
            >
              <ImageIcon className={styles.icon} />
              <span className={styles.imageTitle}>{currentImage.title}</span>
              <ChevronDown className={styles.chevron} />
            </button>
          </PopoverTrigger>
          <button
            type="button"
            className={clsx(
              styles.moveButton,
              glass.button,
              isPanEnabled && isCoverMode && [glass.active, styles.panActive],
              !isCoverMode && styles.unavailable,
            )}
            aria-label={t("toolbar.moveImage")}
            aria-pressed={isCoverMode && isPanEnabled}
            // aria-disabled keeps the button focusable so its hint explains why it is unavailable.
            aria-disabled={!isCoverMode}
            aria-describedby={moveHintId}
            onClick={() => {
              if (isCoverMode) setPanInteractionEnabled(!isPanEnabled);
            }}
          >
            <Move className={styles.icon} />
          </button>
          <span id={moveHintId} className={styles.hint}>
            {isCoverMode ? t("toolbar.moveImageInstructions") : t("toolbar.moveImageUnavailable")}
          </span>
          {coverMode && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={styles.zoomTrigger}
                  aria-label={t("toolbar.zoomButton", { zoom: coverMode.zoom.toFixed(1) })}
                >
                  {coverMode.zoom.toFixed(1)}x
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="center"
                sideOffset={10}
                className={styles.zoomPopover}
              >
                <div className={styles.zoomControls}>
                  <div className={styles.readout}>
                    <span>{t("toolbar.zoom")}</span>
                    <span className={styles.readoutValue}>{coverMode.zoom.toFixed(1)}x</span>
                  </div>
                  <Slider
                    min={0.2}
                    max={10}
                    step={0.1}
                    value={[coverMode.zoom]}
                    aria-label={t("toolbar.zoomLevel")}
                    onValueChange={([z]) => {
                      if (z === undefined) return;
                      setViewportMode({ ...coverMode, zoom: z });
                    }}
                  />
                  <div className={styles.range}>
                    <span>0.2x</span>
                    <span>10x</span>
                  </div>
                  <div className={styles.readout}>
                    <span>{t("toolbar.rotation")}</span>
                    <span className={styles.readoutValue}>
                      {Math.round(coverMode.rotation ?? 0)}°
                    </span>
                  </div>
                  <Slider
                    min={-180}
                    max={180}
                    step={1}
                    value={[coverMode.rotation ?? 0]}
                    aria-label={t("toolbar.rotationAngle")}
                    onValueChange={([rotation]) => {
                      if (rotation === undefined) return;
                      setViewportMode({ ...coverMode, rotation });
                    }}
                  />
                  <div className={styles.range}>
                    <span>-180°</span>
                    <span>180°</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent align="center" sideOffset={10} className={styles.library}>
        <div className={styles.libraryContent}>
          {imageLibraryStatus.status === "error" ? (
            <p className={styles.error}>{errorText(imageLibraryStatus.error)}</p>
          ) : null}
          <div className={styles.group}>
            <button
              type="button"
              className={clsx(styles.dropzone, importDragActive && styles.dropActive)}
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
              <div className={styles.dropIcon}>
                <Upload className={styles.icon} />
              </div>
              <div>
                <p className={styles.entryTitle}>{t("upload.dropHere")}</p>
                <p className={styles.entryMeta}>{t("upload.orBrowse")}</p>
              </div>
            </button>
          </div>

          <div className={styles.group}>
            {howItWorksImages.map((entry) => (
              <ImageRow
                key={entry.id}
                entry={localizeEntry(entry)}
                isActive={currentImage.id === entry.id}
                onSelect={() => void handleSelectImage(entry)}
              />
            ))}
          </div>

          <div className={styles.group}>
            {curatedImages.map((entry) => (
              <ImageRow
                key={entry.id}
                entry={localizeEntry(entry)}
                isActive={currentImage.id === entry.id}
                onSelect={() => void handleSelectImage(entry)}
              />
            ))}
          </div>

          <div className={styles.group}>
            {uploads.length === 0 ? (
              <p className={styles.empty}>{t("toolbar.noUploads")}</p>
            ) : (
              uploads.map((entry) => (
                <div key={entry.id} className={styles.upload}>
                  <ImageRow
                    entry={entry}
                    isActive={currentImage.id === entry.id}
                    onSelect={() => void handleSelectImage(entry)}
                    className={styles.withDelete}
                  />
                  <button
                    type="button"
                    className={styles.delete}
                    aria-label={t("toolbar.removeUpload", { title: entry.title })}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteUpload(entry);
                    }}
                  >
                    <Trash2 className={styles.smallIcon} />
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
        className={styles.fileInput}
        aria-label={t("upload.chooseFile")}
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
    className={clsx(styles.image, isActive && styles.current, className)}
    onClick={onSelect}
  >
    <img src={entry.previewSrc} alt={entry.title} className={styles.thumbnail} loading="lazy" />
    <div>
      <p className={styles.entryTitle}>{entry.title}</p>
      <p className={styles.entryMeta}>{entry.meta}</p>
    </div>
  </button>
);
