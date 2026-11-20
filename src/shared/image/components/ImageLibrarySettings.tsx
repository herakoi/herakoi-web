import { clsx } from "clsx";
import { Upload } from "lucide-react";
import { type ChangeEvent, type ReactNode, useRef, useState } from "react";
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
import { useT } from "../i18n";
import { curatedImages } from "../library/curatedImages";
import { howItWorksImages } from "../library/howItWorksImages";
import type { ImageEntry } from "../types";
import { useImageLibrary } from "../useImageLibrary";
import styles from "./ImageLibrarySettings.module.css";
import { type ImageLibraryBindings, useLibraryErrorText } from "./ImageToolbar";

type ImageLibrarySettingsProps = ImageLibraryBindings & {
  /** Extra controls for the active image, shown under the image picker. */
  renderImageControls?: (entry: ImageEntry) => ReactNode;
};

/** Settings tab of an image sampling plugin: image picker, pan toggle, upload area. */
export const ImageLibrarySettings = ({
  store,
  currentImageId,
  onSelectImage,
  accept = "image/*",
  readUpload,
  onDeleteUpload,
  errorNamespaces,
  renderImageControls,
}: ImageLibrarySettingsProps) => {
  const t = useT();
  const errorText = useLibraryErrorText(errorNamespaces);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const { currentImage, entries, handleImageFile, handleSelectImage } = useImageLibrary({
    store,
    curatedImages,
    howItWorksImages,
    selectedImageId: currentImageId,
    onSelectImage: async (entry) => {
      onSelectImage(entry);
    },
    readUpload,
    onDeleteUpload,
  });
  const imageLibraryStatus = store((state) => state.imageLibraryStatus);
  const viewportMode = store((state) => state.viewportMode);
  const panInteractionEnabled = store((state) => state.panInteractionEnabled);
  const setPanInteractionEnabled = store((state) => state.setPanInteractionEnabled);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImageFile(file);
  };
  const isCoverMode = viewportMode.kind === "cover";
  const currentEntry = entries.find((entry: ImageEntry) => entry.id === currentImage.id);
  const isPanEnabled = panInteractionEnabled;

  return (
    <div className={styles.panel}>
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
      {currentEntry && renderImageControls ? renderImageControls(currentEntry) : null}
      <div className={styles.toggleRow}>
        <Label className={styles.toggleLabel} htmlFor="pan-toggle">
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
        className={clsx(styles.dropzone, dragActive && styles.dragActive)}
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
        <Upload className={styles.icon} />
        <div className={styles.dropTitle}>{t("upload.dropHere")}</div>
        <div className={styles.dropHint}>{t("upload.orBrowse")}</div>
      </button>
      <Input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.fileInput}
        aria-label={t("upload.chooseFile")}
        onChange={handleFile}
      />
      {imageLibraryStatus.status === "error" ? (
        <p className={styles.error} role="alert">
          {errorText(imageLibraryStatus.error)}
        </p>
      ) : null}
    </div>
  );
};
