import { Bug, Hand, Image as ImageIcon, Waves } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CameraDock } from "./components/CameraDock";
import { ControlPanel, type ControlPanelSection } from "./components/ControlPanel";
import { BrandMark } from "./components/header/BrandMark";
import { ImageToolbar } from "./components/header/ImageToolbar";
import { TransportControls } from "./components/header/TransportControls";
import { AudioPanel } from "./components/panels/AudioPanel";
import { DebugPanel } from "./components/panels/DebugPanel";
import { ImagePanel } from "./components/panels/ImagePanel";
import { InputPanel } from "./components/panels/InputPanel";
import { curatedImages } from "./data/curatedImages";
import { howItWorksImages } from "./data/howItWorksImages";
import { useHeaderTone } from "./hooks/useHeaderTone";
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
  const logoRef = useRef<HTMLDivElement>(null);
  const coverButtonRef = useRef<HTMLButtonElement>(null);
  const transportButtonRef = useRef<HTMLButtonElement>(null);
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

  const { currentImage, entries, uploads, handleImageFile, handleSelectImage, handleDeleteUpload } =
    useImageLibrary({
      curatedImages,
      howItWorksImages,
      loadImageFile,
      loadImageSource,
    });

  const { uiFadeStyle } = useUiDimmer({ handDetected, uiDimPercent });
  const { logoTone, coverTone, transportTone } = useHeaderTone({
    imageCanvasRef,
    logoRef,
    coverButtonRef,
    transportButtonRef,
  });

  useImageCoverPan({ imageCanvasRef, imageCover, imagePan, setImagePan });

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
            onToggleCover={() => setImageCover(!imageCover)}
            onFile={handleImageFile}
            onSelectImage={handleSelectImage}
            onDeleteUpload={handleDeleteUpload}
            coverButtonRef={coverButtonRef}
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
            onRestart={() => void start()}
            onStart={() => void start()}
            onStop={() => stop()}
            transportButtonRef={transportButtonRef}
          />
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
