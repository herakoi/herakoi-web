import { Camera, Palette, Radio, Waves } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ControlPanel, type ControlPanelSection } from "./components/ControlPanel";
import { PiPPanel, type PiPState } from "./components/PiPPanel";
import { ReactiveMark } from "./components/ReactiveMark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Slider } from "./components/ui/slider";
import { Switch } from "./components/ui/switch";
import { usePipeline } from "./hooks/usePipeline";
import { usePipelineStore } from "./state/pipelineStore";

const CameraPanel = () => {
  const mirror = usePipelineStore((state) => state.mirror);
  const setMirror = usePipelineStore((state) => state.setMirror);
  const maxHands = usePipelineStore((state) => state.maxHands);
  const setMaxHands = usePipelineStore((state) => state.setMaxHands);
  const facingMode = usePipelineStore((state) => state.facingMode);
  const setFacingMode = usePipelineStore((state) => state.setFacingMode);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Camera className="h-5 w-5" />
          <CardTitle>Camera & Tracking</CardTitle>
        </div>
        <CardDescription>Mirror for selfie mode, pick a camera, tune max hands.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Mirror overlay</p>
            <p className="text-xs text-muted-foreground">Flip X to match selfie view.</p>
          </div>
          <Switch checked={mirror} onCheckedChange={setMirror} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-hands">Hands</Label>
          <Slider
            id="max-hands"
            min={1}
            max={4}
            step={1}
            value={[maxHands]}
            aria-label="Maximum hands"
            onValueChange={([value]) => setMaxHands(value)}
          />
          <p className="text-xs text-muted-foreground">Tracking up to {maxHands} hand(s).</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="camera-facing">Camera facing</Label>
          <Select
            value={facingMode}
            onValueChange={(value) => setFacingMode(value as "user" | "environment")}
          >
            <SelectTrigger id="camera-facing" aria-label="Camera facing">
              <SelectValue placeholder="Choose camera" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="user">Front (user)</SelectItem>
              <SelectItem value="environment">Rear (environment)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

const AudioPanel = () => {
  const oscillator = usePipelineStore((state) => state.oscillator);
  const setOscillator = usePipelineStore((state) => state.setOscillator);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Waves className="h-5 w-5" />
          <CardTitle>Audio mapping</CardTitle>
        </div>
        <CardDescription>Hue → frequency, value → volume. Tune ranges live.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
};

const ImagePanel = ({ onFile }: { onFile: (file: File) => Promise<void> }) => {
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await onFile(file);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Palette className="h-5 w-5" />
          <CardTitle>Source image</CardTitle>
        </div>
        <CardDescription>Always-on background feed for HSV sampling.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Default background is the zodiac constellation art bundled with the project. Drop-in file
          upload wiring can replace this without touching pipeline code.
        </p>
        <Input type="file" accept="image/*" onChange={handleFile} />
        <p className="text-xs text-muted-foreground">
          Upload replaces the sampled background immediately.
        </p>
      </CardContent>
    </Card>
  );
};

const DebugPanel = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Radio className="h-5 w-5" />
          <CardTitle>Debug & overlays</CardTitle>
        </div>
        <CardDescription>Toggle dev HUD and view canvases over the background.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Overlays use the existing MediaPipe drawers. The dev HUD (`?dev`) from{" "}
          <code>src/debug</code> still works to visualize frequency/volume per fingertip.
        </p>
      </CardContent>
    </Card>
  );
};

const App = () => {
  type PanelKey = "camera" | "audio" | "image" | "debug";

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoOverlayRef = useRef<HTMLCanvasElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const { start, stop, status, error, loadImageFile, analyser } = usePipeline({
    videoRef,
    videoOverlayRef,
    imageCanvasRef,
    imageOverlayRef,
  });
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const mirror = usePipelineStore((state) => state.mirror);
  const [pip, setPip] = useState<PiPState>({
    x: 16,
    y: 16,
    width: 260,
  });
  const [pipOpen, setPipOpen] = useState(true);

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  const sections: ControlPanelSection<PanelKey>[] = [
    {
      key: "camera",
      label: "Camera",
      title: "Camera & Tracking",
      render: () => <CameraPanel />,
    },
    {
      key: "audio",
      label: "Audio",
      title: "Audio mapping",
      render: () => <AudioPanel />,
    },
    {
      key: "image",
      label: "Image",
      title: "Source image",
      render: () => <ImagePanel onFile={loadImageFile} />,
    },
    {
      key: "debug",
      label: "Debug",
      title: "Debug",
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/80" />
      </div>

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-3">
        <ReactiveMark analyserRef={analyser} size={56} className="relative z-0 -mr-4 opacity-95" />
        <span className="relative z-10 font-brand text-[28px] font-normal leading-none text-white/95">
          herakoi
        </span>
      </div>

      <ControlPanel
        status={status}
        error={error ?? null}
        openSection={openPanel}
        setOpenSection={setOpenPanel}
        sections={sections}
        onRestart={() => void start()}
        onStop={() => stop()}
      />

      <PiPPanel
        open={pipOpen}
        onToggle={() => setPipOpen((prev) => !prev)}
        mirror={mirror}
        pip={pip}
        setPip={setPip}
        videoRef={videoRef}
        overlayRef={videoOverlayRef}
      />
    </div>
  );
};

export default App;
