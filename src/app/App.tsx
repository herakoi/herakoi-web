import { Bug, Hand, Image as ImageIcon, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CameraDock } from "./components/CameraDock";
import { ControlPanel, type ControlPanelSection } from "./components/ControlPanel";
import { BrandMark } from "./components/header/BrandMark";
import { ImageToolbar } from "./components/header/ImageToolbar";
import { TransportControls } from "./components/header/TransportControls";
import { AudioPanel } from "./components/panels/AudioPanel";
import { DebugPanel } from "./components/panels/DebugPanel";
import { ImagePanel } from "./components/panels/ImagePanel";
import { InputPanel } from "./components/panels/InputPanel";
import { ScreenReaderAnnouncer } from "./components/ScreenReaderAnnouncer";
import { curatedImages } from "./data/curatedImages";
import { howItWorksImages } from "./data/howItWorksImages";
import { type ToneTarget, useHeaderTone } from "./hooks/useHeaderTone";
import { useImageCoverPan } from "./hooks/useImageCoverPan";
import { useImageLibrary } from "./hooks/useImageLibrary";
import { usePipeline } from "./hooks/usePipeline";
import { useUiDimmer } from "./hooks/useUiDimmer";
import { usePipelineStore } from "./state/pipelineStore";

const App = () => {
  type PanelKey = "audio" | "image" | "input" | "debug";

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoOverlayRef = useRef<HTMLCanvasElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);
  const coverButtonRef = useRef<HTMLButtonElement>(null);
  const transportButtonRef = useRef<HTMLButtonElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const cameraToggleRef = useRef<HTMLButtonElement>(null);
  const cameraSelectRef = useRef<HTMLButtonElement>(null);
  const { start, stop, status, error, loadImageFile, loadImageSource, analyser } = usePipeline({
    videoRef,
    videoOverlayRef,
    imageCanvasRef,
    imageOverlayRef,
  });
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
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

  const statusAnnouncement = useMemo(() => {
    switch (status) {
      case "initializing":
        return "Pipeline initializing";
      case "running":
        return "Pipeline running";
      case "error":
        return `Pipeline error: ${error ?? "unknown"}`;
      case "idle":
        return "Pipeline stopped";
      default:
        return "";
    }
  }, [status, error]);

  const handAnnouncement = handDetected ? "Hand detected" : "";

  const {
    currentImage,
    entries,
    uploads,
    imageHydrated,
    handleImageFile,
    handleSelectImage,
    handleDeleteUpload,
  } = useImageLibrary({
    curatedImages,
    howItWorksImages,
    loadImageFile,
    loadImageSource,
  });

  const { uiFadeStyle, uiDimmed } = useUiDimmer({ handDetected, uiDimPercent });
  const toneTargets = useMemo<ToneTarget[]>(
    () => [
      { key: "import", ref: importButtonRef },
      { key: "image", ref: imageButtonRef },
      { key: "restart", ref: restartButtonRef },
      { key: "settings", ref: settingsButtonRef },
      { key: "help", ref: helpButtonRef },
      { key: "cameraToggle", ref: cameraToggleRef },
      { key: "cameraSelect", ref: cameraSelectRef },
    ],
    [],
  );

  const { logoTone, coverTone, transportTone, extraTones } = useHeaderTone({
    imageCanvasRef,
    logoRef,
    coverButtonRef,
    transportButtonRef,
    extraTargets: toneTargets,
  });

  useImageCoverPan({ imageCanvasRef, imageCover, imagePan, setImagePan });

  useEffect(() => {
    if (!imageHydrated) return;
    void start();
    return () => stop();
  }, [imageHydrated, start, stop]);

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
          entries={entries}
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
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <a
        href="#herakoi-main-canvas"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <div className="absolute inset-0">
        <canvas
          ref={imageCanvasRef}
          id="herakoi-main-canvas"
          tabIndex={-1}
          className="h-full w-full"
          role="img"
          aria-label="Herakoi audio-visualizer output"
        />
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: Overlay canvas is decorative and not interactive */}
        <canvas
          ref={imageOverlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/55"
          style={{
            opacity: uiDimmed ? 0 : 1,
            transitionProperty: "opacity",
            transitionDuration: uiFadeStyle.transitionDuration,
            transitionTimingFunction: uiFadeStyle.transitionTimingFunction,
          }}
          aria-hidden="true"
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center transition-opacity duration-700"
        style={{ opacity: isRunning && !handDetected ? 1 : 0 }}
      >
        <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/45 px-6 py-3 backdrop-blur">
          <Hand className="h-5 w-5 text-white/70" />
          <span className="font-sans text-sm font-medium tracking-wide text-white/80">
            Show your hands to the camera
          </span>
        </div>
      </div>

      <header className="pointer-events-none absolute left-1 right-4 top-4 z-10 flex items-center">
        <BrandMark
          analyserRef={analyser}
          logoTone={logoTone}
          dimLogoMark={dimLogoMark}
          uiFadeStyle={uiFadeStyle}
          logoRef={logoRef}
        />
        <div
          className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center justify-center transition-opacity"
          style={uiFadeStyle}
        >
          <ImageToolbar
            currentImage={currentImage}
            howItWorksImages={howItWorksImages}
            curatedImages={curatedImages}
            uploads={uploads}
            imageCover={imageCover}
            coverTone={coverTone}
            importTone={extraTones.import ?? "light"}
            imageTone={extraTones.image ?? "light"}
            onToggleCover={() => setImageCover(!imageCover)}
            onFile={handleImageFile}
            onSelectImage={handleSelectImage}
            onDeleteUpload={handleDeleteUpload}
            coverButtonRef={coverButtonRef}
            importButtonRef={importButtonRef}
            imageButtonRef={imageButtonRef}
          />
        </div>
        <div
          className="pointer-events-auto ml-auto flex items-center justify-end gap-2 transition-opacity"
          style={uiFadeStyle}
        >
          <TransportControls
            isActive={isActive}
            isInitializing={isInitializing}
            transportTone={transportTone}
            restartTone={extraTones.restart ?? transportTone}
            onRestart={() => void start()}
            onStart={() => void start()}
            onStop={() => stop()}
            transportButtonRef={transportButtonRef}
            restartButtonRef={restartButtonRef}
          />
        </div>
      </header>

      <ControlPanel
        error={error ?? null}
        openSection={openPanel}
        setOpenSection={setOpenPanel}
        sections={sections}
        settingsTone={extraTones.settings ?? "light"}
        helpTone={extraTones.help ?? "light"}
        settingsButtonRef={settingsButtonRef}
        helpButtonRef={helpButtonRef}
        className="transition-opacity"
        style={uiFadeStyle}
      />

      <div className="transition-opacity" style={uiFadeStyle}>
        <CameraDock
          videoRef={videoRef}
          overlayRef={videoOverlayRef}
          onStart={() => void start()}
          onStop={() => stop()}
          cameraTone={extraTones.cameraToggle ?? "light"}
          cameraSelectTone={extraTones.cameraSelect ?? "light"}
          cameraToggleRef={cameraToggleRef}
          cameraSelectRef={cameraSelectRef}
        />
      </div>

      <ScreenReaderAnnouncer message={statusAnnouncement} politeness="assertive" />
      <ScreenReaderAnnouncer message={handAnnouncement} />
    </main>
  );
};

export default App;
