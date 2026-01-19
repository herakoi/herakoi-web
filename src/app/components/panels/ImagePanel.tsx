import { Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type { ImageEntry } from "../../types/image";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

type ImagePanelProps = {
  onFile: (file: File) => Promise<void>;
  entries: ImageEntry[];
  currentImageId: string;
  onSelectImage: (entry: ImageEntry) => void;
  imageCover: boolean;
  setImageCover: (cover: boolean) => void;
};

export const ImagePanel = ({
  onFile,
  entries,
  currentImageId,
  onSelectImage,
  imageCover,
  setImageCover,
}: ImagePanelProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await onFile(file);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <Select
        value={currentImageId}
        onValueChange={(value) => {
          const entry = entries.find((item) => item.id === value);
          if (!entry) return;
          void onSelectImage(entry);
        }}
      >
        <SelectTrigger id="active-image" aria-label="Active image">
          <SelectValue placeholder="Active image" />
        </SelectTrigger>
        <SelectContent>
          {entries.map((entry) => (
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
        <Switch id="cover-toggle" checked={imageCover} onCheckedChange={setImageCover} />
      </div>
      <button
        type="button"
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
          await onFile(file);
        }}
      >
        <Upload className="h-4 w-4" />
        <div className="text-sm font-medium text-foreground">Drop image here</div>
        <div className="text-xs text-muted-foreground">or click to browse</div>
      </button>
      <Input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};
