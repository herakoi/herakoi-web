import {
  Bug,
  ChevronDown,
  Crop,
  Hand,
  Image as ImageIcon,
  Loader2,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CameraDock } from "./components/CameraDock";
import { ControlPanel, type ControlPanelSection } from "./components/ControlPanel";
import { ReactiveMark } from "./components/ReactiveMark";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Slider } from "./components/ui/slider";
import { Switch } from "./components/ui/switch";
import { curatedImages } from "./data/curatedImages";
import { usePipeline } from "./hooks/usePipeline";
import { cn } from "./lib/utils";
import { usePipelineStore } from "./state/pipelineStore";

const IMAGE_CACHE_KEY = "herakoi.image-cache.v1";

type ImageEntry = {
  id: string;
  title: string;
  meta: string;
  src: string;
  previewSrc: string;
  kind: "curated" | "how" | "upload";
  addedAt?: number;
};

const gammaTestSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff0000" />
      <stop offset="16%" stop-color="#ffff00" />
      <stop offset="33%" stop-color="#00ff00" />
      <stop offset="50%" stop-color="#00ffff" />
      <stop offset="66%" stop-color="#0000ff" />
      <stop offset="83%" stop-color="#ff00ff" />
      <stop offset="100%" stop-color="#ff0000" />
    </linearGradient>
    <linearGradient id="sat" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="hsl(200, 0%, 50%)" />
      <stop offset="100%" stop-color="hsl(200, 100%, 50%)" />
    </linearGradient>
    <linearGradient id="val" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000000" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="#0b0b0b" />
  <rect x="80" y="80" width="1040" height="200" rx="24" fill="url(#hue)" />
  <rect x="80" y="320" width="1040" height="160" rx="24" fill="url(#sat)" />
  <rect x="80" y="520" width="1040" height="160" rx="24" fill="url(#val)" />
  <circle cx="200" cy="180" r="70" fill="#ffffff" />
  <circle cx="360" cy="180" r="70" fill="#00ffff" />
  <circle cx="520" cy="180" r="70" fill="#ff00ff" />
  <circle cx="680" cy="180" r="70" fill="#00ff00" />
  <circle cx="840" cy="180" r="70" fill="#ffcc00" />
  <circle cx="1000" cy="180" r="70" fill="#ff0000" />
</svg>
`.trim();

const gammaTestUrl = `data:image/svg+xml;utf8,${encodeURIComponent(gammaTestSvg)}`;

const howItWorksImages: ImageEntry[] = [
  {
    id: "how-gamma-test",
    title: "Gamma color test",
    meta: "HSV sweep - SVG",
    src: gammaTestUrl,
    previewSrc: gammaTestUrl,
    kind: "how",
  },
];

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatImageType = (mimeType: string) => {
  const [, subtype] = mimeType.split("/");
  return subtype ? subtype.toUpperCase() : "IMG";
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image data"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image data"));
    reader.readAsDataURL(file);
  });

const loadImageDimensions = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image metadata"));
    img.src = src;
  });

const InputPanel = () => {
  const mirror = usePipelineStore((state) => state.mirror);
  const setMirror = usePipelineStore((state) => state.setMirror);
  const maxHands = usePipelineStore((state) => state.maxHands);
  const setMaxHands = usePipelineStore((state) => state.setMaxHands);
  const facingMode = usePipelineStore((state) => state.facingMode);
  const setFacingMode = usePipelineStore((state) => state.setFacingMode);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="max-hands">Tracked hands ({maxHands})</Label>
        <Slider
          id="max-hands"
          min={1}
          max={4}
          step={1}
          value={[maxHands]}
          aria-label="Tracked hands"
          onValueChange={([value]) => setMaxHands(value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="camera-facing">Active camera</Label>
        <Select
          value={facingMode}
          onValueChange={(value) => setFacingMode(value as "user" | "environment")}
        >
          <SelectTrigger id="camera-facing" aria-label="Active camera">
            <SelectValue placeholder="Choose camera" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="user">Front (user)</SelectItem>
            <SelectItem value="environment">Rear (environment)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium" htmlFor="mirror-toggle">
          Mirror camera
        </Label>
        <Switch id="mirror-toggle" checked={mirror} onCheckedChange={setMirror} />
      </div>
    </div>
  );
};

const AudioPanel = () => {
  const oscillator = usePipelineStore((state) => state.oscillator);
  const setOscillator = usePipelineStore((state) => state.setOscillator);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          Frequency range ({oscillator.minFreq}Hz – {oscillator.maxFreq}Hz)
        </Label>
        <Slider
          min={100}
          max={2000}
          step={10}
          value={[oscillator.minFreq, oscillator.maxFreq]}
          aria-label="Frequency range"
          thumbLabels={["Minimum frequency", "Maximum frequency"]}
          onValueChange={([min, max]) => setOscillator({ minFreq: min, maxFreq: max })}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Volume range ({Math.round(oscillator.minVol * 100)}% –{" "}
          {Math.round(oscillator.maxVol * 100)}%)
        </Label>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[oscillator.minVol * 100, oscillator.maxVol * 100]}
          aria-label="Volume range"
          thumbLabels={["Minimum volume", "Maximum volume"]}
          onValueChange={([min, max]) => setOscillator({ minVol: min / 100, maxVol: max / 100 })}
        />
      </div>
      <div className="space-y-2">
        <Label>Waveform</Label>
        <Select
          value={oscillator.oscillatorType}
          onValueChange={(value) => setOscillator({ oscillatorType: value as OscillatorType })}
        >
          <SelectTrigger aria-label="Oscillator waveform">
            <SelectValue placeholder="Waveform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sine">Sine</SelectItem>
            <SelectItem value="triangle">Triangle</SelectItem>
            <SelectItem value="sawtooth">Sawtooth</SelectItem>
            <SelectItem value="square">Square</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

type ImagePanelProps = {
  onFile: (file: File) => Promise<void>;
  entries: ImageEntry[];
  currentImageId: string;
  onSelectImage: (entry: ImageEntry) => void;
  imageCover: boolean;
  setImageCover: (cover: boolean) => void;
};

const ImagePanel = ({
  onFile,
  entries,
  currentImageId,
  onSelectImage,
  imageCover,
  setImageCover,
}: ImagePanelProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

const DebugPanel = () => {
  const uiDimPercent = usePipelineStore((state) => state.uiDimPercent);
  const setUiDimPercent = usePipelineStore((state) => state.setUiDimPercent);
  const dimLogoMark = usePipelineStore((state) => state.dimLogoMark);
  const setDimLogoMark = usePipelineStore((state) => state.setDimLogoMark);
  const [debugEnabled, setDebugEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.has("dev");
  });

  const handleDebug = () => {
    const nextUrl = new URL(window.location.href);
    const willEnable = !debugEnabled;
    if (willEnable) {
      nextUrl.searchParams.set("dev", "1");
    } else {
      nextUrl.searchParams.delete("dev");
    }
    window.history.replaceState({}, "", nextUrl.toString());
    setDebugEnabled(willEnable);
    window.dispatchEvent(new Event("herakoi-debug-toggle"));
  };

  return (
    <div className="space-y-4">
      <Button variant={debugEnabled ? "secondary" : "outline"} onClick={handleDebug}>
        {debugEnabled ? "Disable Dev HUD" : "Enable Dev HUD"}
      </Button>
      <div className="space-y-2">
        <Label>UI dim level ({uiDimPercent}%)</Label>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[uiDimPercent]}
          aria-label="UI dim level"
          onValueChange={([value]) => setUiDimPercent(value)}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium" htmlFor="dim-logo-mark">
          Dim logo mark on idle
        </Label>
        <Switch id="dim-logo-mark" checked={dimLogoMark} onCheckedChange={setDimLogoMark} />
      </div>
    </div>
  );
};

const App = () => {
  type PanelKey = "audio" | "image" | "input" | "debug";

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoOverlayRef = useRef<HTMLCanvasElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const logoSampleRef = useRef<HTMLCanvasElement | null>(null);
  const coverButtonRef = useRef<HTMLButtonElement>(null);
  const transportButtonRef = useRef<HTMLButtonElement>(null);
  const headerToneRafRef = useRef<number | null>(null);
  const uiIdleTimeoutRef = useRef<number | null>(null);
  const lastMouseMoveRef = useRef<number>(performance.now());
  const handDetectedRef = useRef(false);
  const { start, stop, status, error, loadImageFile, loadImageSource, analyser } = usePipeline({
    videoRef,
    videoOverlayRef,
    imageCanvasRef,
    imageOverlayRef,
  });
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [currentImage, setCurrentImage] = useState(() => {
    const fallback = curatedImages[0] ?? howItWorksImages[0];
    return {
      id: fallback?.id ?? "curated-default",
      title: fallback?.title ?? "Curated image",
    };
  });
  const [logoTone, setLogoTone] = useState<"light" | "dark">("light");
  const [coverTone, setCoverTone] = useState<"light" | "dark">("light");
  const [transportTone, setTransportTone] = useState<"light" | "dark">("light");
  const [uiDimmed, setUiDimmed] = useState(false);
  const [uploads, setUploads] = useState<ImageEntry[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [importDragActive, setImportDragActive] = useState(false);
  const imageCover = usePipelineStore((state) => state.imageCover);
  const setImageCover = usePipelineStore((state) => state.setImageCover);
  const imagePan = usePipelineStore((state) => state.imagePan);
  const setImagePan = usePipelineStore((state) => state.setImagePan);
  const handDetected = usePipelineStore((state) => state.handDetected);
  const uiDimPercent = usePipelineStore((state) => state.uiDimPercent);
  const dimLogoMark = usePipelineStore((state) => state.dimLogoMark);
  const isRunning = status === "running";
  const isInitializing = status === "initializing";
  const isActive = isRunning || isInitializing;
  const uiDimDelayMs = 5000;
  const uiDimFadeMs = 7000;
  const uiDimResetMs = 800;
  const uiOpacity = uiDimmed ? uiDimPercent / 100 : 1;
  const uiFadeStyle = {
    opacity: uiOpacity,
    transitionDuration: uiDimmed ? `${uiDimFadeMs}ms` : `${uiDimResetMs}ms`,
    transitionTimingFunction: uiDimmed ? "ease-out" : "ease-in-out",
  };
  const imageEntries = [...howItWorksImages, ...curatedImages, ...uploads];
  const imagePanRef = useRef(imagePan);

  useEffect(() => {
    imagePanRef.current = imagePan;
  }, [imagePan]);

  useEffect(() => {
    const stored = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ImageEntry[];
      setUploads(
        parsed
          .filter((entry) => entry.kind === "upload")
          .map((entry) => ({ ...entry, previewSrc: entry.previewSrc ?? entry.src })),
      );
    } catch {
      setUploads([]);
    }
  }, []);

  const persistUploads = useCallback((nextUploads: ImageEntry[]) => {
    try {
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(nextUploads));
    } catch {}
  }, []);

  const handleImageFile = useCallback(
    async (file: File) => {
      await loadImageFile(file);
      const id = `upload-${file.name}-${file.size}-${file.lastModified}`;
      setCurrentImage({ id, title: file.name });
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const { width, height } = await loadImageDimensions(dataUrl);
        const meta = `${width}x${height} - ${formatBytes(file.size)} - ${formatImageType(
          file.type,
        )}`;
        const entry: ImageEntry = {
          id,
          title: file.name,
          meta,
          src: dataUrl,
          previewSrc: dataUrl,
          kind: "upload",
          addedAt: Date.now(),
        };
        setUploads((prev) => {
          const next = [entry, ...prev.filter((item) => item.id !== id)];
          persistUploads(next);
          return next;
        });
      } catch {}
    },
    [loadImageFile, persistUploads],
  );

  const handleSelectImage = useCallback(
    async (entry: ImageEntry) => {
      await loadImageSource(entry.src);
      setCurrentImage({ id: entry.id, title: entry.title });
    },
    [loadImageSource],
  );

  const handleDeleteUpload = useCallback(
    (entry: ImageEntry) => {
      const nextUploads = uploads.filter((item) => item.id !== entry.id);
      setUploads(nextUploads);
      persistUploads(nextUploads);
      if (currentImage.id === entry.id) {
        const fallback = curatedImages[0] ?? howItWorksImages[0] ?? nextUploads[0];
        if (fallback) {
          void handleSelectImage(fallback);
        }
      }
    },
    [currentImage.id, handleSelectImage, persistUploads, uploads],
  );

  const handleImageInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await handleImageFile(file);
      event.target.value = "";
    },
    [handleImageFile],
  );

  const scheduleUiDimCheck = useCallback(() => {
    if (uiIdleTimeoutRef.current !== null) {
      window.clearTimeout(uiIdleTimeoutRef.current);
    }
    if (!handDetectedRef.current) {
      setUiDimmed(false);
      return;
    }
    const idleFor = performance.now() - lastMouseMoveRef.current;
    if (idleFor >= uiDimDelayMs) {
      setUiDimmed(true);
      return;
    }
    setUiDimmed(false);
    uiIdleTimeoutRef.current = window.setTimeout(() => {
      if (!handDetectedRef.current) return;
      const idleNow = performance.now() - lastMouseMoveRef.current;
      if (idleNow >= uiDimDelayMs) {
        setUiDimmed(true);
      }
    }, uiDimDelayMs - idleFor);
  }, []);

  const sampleElementTone = useCallback((element: HTMLElement | null) => {
    const canvas = imageCanvasRef.current;
    if (!canvas || !element) return null;

    const canvasRect = canvas.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();
    if (canvasRect.width === 0 || canvasRect.height === 0) return;

    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    const sx = Math.max(0, Math.floor((targetRect.left - canvasRect.left) * scaleX));
    const sy = Math.max(0, Math.floor((targetRect.top - canvasRect.top) * scaleY));
    const sw = Math.min(canvas.width - sx, Math.floor(targetRect.width * scaleX));
    const sh = Math.min(canvas.height - sy, Math.floor(targetRect.height * scaleY));
    if (sw <= 0 || sh <= 0) return null;

    const sampleCanvas = logoSampleRef.current ?? document.createElement("canvas");
    logoSampleRef.current = sampleCanvas;
    const sampleW = Math.max(12, Math.min(64, sw));
    const sampleH = Math.max(12, Math.min(32, sh));
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;

    const sampleCtx = sampleCanvas.getContext("2d");
    if (!sampleCtx) return;
    sampleCtx.clearRect(0, 0, sampleW, sampleH);
    sampleCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sampleW, sampleH);
    const data = sampleCtx.getImageData(0, 0, sampleW, sampleH).data;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    }
    const avg = total / (255 * (data.length / 4));
    return avg > 0.62 ? "dark" : "light";
  }, []);

  const updateHeaderTones = useCallback(() => {
    const nextLogoTone = sampleElementTone(logoRef.current);
    if (nextLogoTone) {
      setLogoTone((prev) => (prev === nextLogoTone ? prev : nextLogoTone));
    }

    const nextCoverTone = sampleElementTone(coverButtonRef.current);
    if (nextCoverTone) {
      setCoverTone((prev) => (prev === nextCoverTone ? prev : nextCoverTone));
    }

    const nextTransportTone = sampleElementTone(transportButtonRef.current);
    if (nextTransportTone) {
      setTransportTone((prev) => (prev === nextTransportTone ? prev : nextTransportTone));
    }
  }, [sampleElementTone]);

  useEffect(() => {
    if (headerToneRafRef.current !== null) {
      cancelAnimationFrame(headerToneRafRef.current);
    }
    headerToneRafRef.current = requestAnimationFrame(() => {
      headerToneRafRef.current = null;
      updateHeaderTones();
    });
    return () => {
      if (headerToneRafRef.current !== null) {
        cancelAnimationFrame(headerToneRafRef.current);
        headerToneRafRef.current = null;
      }
    };
  }, [updateHeaderTones]);

  useEffect(() => {
    handDetectedRef.current = handDetected;
    scheduleUiDimCheck();
    return () => {
      if (uiIdleTimeoutRef.current !== null) {
        window.clearTimeout(uiIdleTimeoutRef.current);
        uiIdleTimeoutRef.current = null;
      }
    };
  }, [handDetected, scheduleUiDimCheck]);

  useEffect(() => {
    const handleMouseMove = () => {
      lastMouseMoveRef.current = performance.now();
      setUiDimmed(false);
      scheduleUiDimCheck();
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [scheduleUiDimCheck]);

  useEffect(() => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    canvas.style.cursor = imageCover ? "grab" : "default";
    canvas.style.touchAction = imageCover ? "none" : "auto";
    if (!imageCover) return;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;

    const applyPan = () => {
      if (!pendingX && !pendingY) return;
      const current = imagePanRef.current;
      setImagePan({ x: current.x + pendingX, y: current.y + pendingY });
      pendingX = 0;
      pendingY = 0;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      pendingX += dx;
      pendingY += dy;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          applyPan();
        });
      }
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      canvas.style.cursor = "grab";
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      applyPan();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      canvas.style.cursor = "default";
      canvas.style.touchAction = "auto";
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [imageCover, setImagePan]);

  useEffect(() => {
    const handleResize = () => {
      if (headerToneRafRef.current !== null) return;
      headerToneRafRef.current = requestAnimationFrame(() => {
        headerToneRafRef.current = null;
        updateHeaderTones();
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateHeaderTones]);

  useEffect(() => {
    const handleImageRendered = () => {
      if (headerToneRafRef.current !== null) return;
      headerToneRafRef.current = requestAnimationFrame(() => {
        headerToneRafRef.current = null;
        updateHeaderTones();
      });
    };
    window.addEventListener("herakoi-image-rendered", handleImageRendered);
    return () => window.removeEventListener("herakoi-image-rendered", handleImageRendered);
  }, [updateHeaderTones]);

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  const sections: ControlPanelSection<PanelKey>[] = [
    {
      key: "audio",
      label: "Audio",
      icon: <Waves className="h-3.5 w-3.5" />,
      render: () => <AudioPanel />,
    },
    {
      key: "image",
      label: "Image",
      icon: <ImageIcon className="h-3.5 w-3.5" />,
      render: () => (
        <ImagePanel
          onFile={handleImageFile}
          entries={imageEntries}
          currentImageId={currentImage.id}
          onSelectImage={handleSelectImage}
          imageCover={imageCover}
          setImageCover={setImageCover}
        />
      ),
    },
    {
      key: "input",
      label: "Input",
      icon: <Hand className="h-3.5 w-3.5" />,
      render: () => <InputPanel />,
    },
    {
      key: "debug",
      label: "Debug",
      icon: <Bug className="h-3.5 w-3.5" />,
      render: () => <DebugPanel />,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0">
        <canvas ref={imageCanvasRef} className="h-full w-full" />
        <canvas
          ref={imageOverlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/55" />
      </div>

      <header className="pointer-events-none absolute left-1 right-4 top-4 z-10 flex items-center">
        <div ref={logoRef} className="flex min-w-0 items-center gap-5">
          <div className="transition-opacity" style={dimLogoMark ? uiFadeStyle : undefined}>
            <ReactiveMark
              analyserRef={analyser}
              size={56}
              tone={logoTone}
              className="relative z-0 -mr-4 origin-left scale-[1.3] opacity-95"
            />
          </div>
          <span
            className={cn(
              "relative z-10 hidden font-brand text-[28px] font-normal leading-none transition-opacity sm:inline",
              logoTone === "dark" ? "text-neutral-900/80" : "text-white/95",
            )}
            style={uiFadeStyle}
          >
            herakoi
          </span>
        </div>
        <div
          className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center justify-center transition-opacity"
          style={uiFadeStyle}
        >
          <Popover>
            <PopoverAnchor asChild>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-black/50 text-muted-foreground backdrop-blur transition hover:bg-black/70"
                  aria-label="Import image"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                </button>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-border/50 bg-black/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/80 backdrop-blur transition hover:bg-black/70"
                    title={currentImage.title}
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
                    imageCover
                      ? coverTone === "dark"
                        ? "border-black/40 bg-neutral-900/85 text-white shadow-sm"
                        : "border-white/40 bg-white/10 text-white"
                      : coverTone === "dark"
                        ? "border-black/25 bg-white/80 text-neutral-900/80 hover:bg-white/90"
                        : "border-border/50 bg-black/50 text-muted-foreground hover:bg-black/70",
                  )}
                  aria-label="Toggle cover mode"
                  aria-pressed={imageCover}
                  onClick={() => setImageCover(!imageCover)}
                  ref={coverButtonRef}
                >
                  <Crop className="h-4 w-4" />
                </button>
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="center"
              sideOffset={10}
              className="w-[360px] border border-border/60 bg-card/90 p-3 text-card-foreground shadow-card backdrop-blur"
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
                    onClick={() => imageInputRef.current?.click()}
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
                    <button
                      key={entry.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
                        currentImage.id === entry.id
                          ? "border-white/35 bg-white/5"
                          : "border-transparent hover:border-white/20 hover:bg-white/5",
                      )}
                      onClick={() => void handleSelectImage(entry)}
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
                      onClick={() => void handleSelectImage(entry)}
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
                          onClick={() => void handleSelectImage(entry)}
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
          </Popover>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageInput}
          />
        </div>
        <div
          className="pointer-events-auto ml-auto flex items-center justify-end gap-2 transition-opacity"
          style={uiFadeStyle}
        >
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-black/50 text-muted-foreground backdrop-blur transition hover:bg-black/70"
            aria-label="Restart pipeline"
            onClick={() => void start()}
            disabled={isInitializing}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition",
              isActive
                ? transportTone === "dark"
                  ? "border-red-600/50 bg-white/85 text-red-700 hover:bg-white"
                  : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                : transportTone === "dark"
                  ? "border-emerald-600/50 bg-white/85 text-emerald-700 hover:bg-white"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
            )}
            aria-label={isActive ? "Stop pipeline" : "Start pipeline"}
            onClick={() => (isActive ? stop() : void start())}
            disabled={isInitializing}
            ref={transportButtonRef}
          >
            {isInitializing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isActive ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      <ControlPanel
        error={error ?? null}
        openSection={openPanel}
        setOpenSection={setOpenPanel}
        sections={sections}
        className="transition-opacity"
        style={uiFadeStyle}
      />

      <div className="transition-opacity" style={uiFadeStyle}>
        <CameraDock
          videoRef={videoRef}
          overlayRef={videoOverlayRef}
          onStart={() => void start()}
          onStop={() => stop()}
        />
      </div>
    </div>
  );
};

export default App;
