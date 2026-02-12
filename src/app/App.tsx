import { Bug } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useImageCoverPan } from "#src/sampling/hsv/hooks/useImageCoverPan";
import { BrandMark } from "./components/header/BrandMark";
import { Controls } from "./components/header/Controls";
import { PipelineStatusAnnouncer } from "./components/PipelineStatusAnnouncer";
import { PluginNotifications } from "./components/PluginNotifications";
import { DebugPanel } from "./components/panels/DebugPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { usePipeline } from "./hooks/usePipeline";
import { usePluginUi } from "./hooks/usePluginUi";
import { useUiDimFade } from "./hooks/useUiDimFade";
import { pipelineConfig } from "./pipelineConfig";
import { usePipelineStore } from "./state/pipelineStore";

const App = () => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);
  const transportButtonRef = useRef<HTMLButtonElement>(null);

  const { start, stop, status, analyser } = usePipeline(pipelineConfig, {
    imageCanvasRef,
    imageOverlayRef,
  });
  const setUiOpacity = usePipelineStore((state) => state.setUiOpacity);
  const dimLogoMark = usePipelineStore((state) => state.dimLogoMark);

  const { sections, SamplingToolbar, DockPanel } = usePluginUi({
    config: pipelineConfig,
    start,
    stop,
  });

  const isRunning = status.status === "running";
  const isInitializing = status.status === "initializing";
  const isActive = isRunning || isInitializing;

  const { uiFadeStyle, uiDimmed } = useUiDimFade();

  // Plugin-owned cover/pan interaction on the image canvas
  useImageCoverPan();

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  // Add debug panel to plugin sections
  const sectionsWithDebug = useMemo(
    () => [
      ...sections,
      {
        key: "debug",
        label: "Debug",
        icon: <Bug className="h-3.5 w-3.5" />,
        render: () => <DebugPanel />,
      },
    ],
    [sections],
  );

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

      <PluginNotifications />

      <header className="pointer-events-none absolute left-2 right-2 top-3 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:left-1 sm:right-4 sm:top-4 sm:gap-2">
        <div className="justify-self-start">
          <BrandMark
            analyserRef={analyser}
            dimLogoMark={dimLogoMark}
            uiFadeStyle={uiFadeStyle}
            logoRef={logoRef}
          />
        </div>
        <div
          className="pointer-events-auto flex items-center justify-center transition-opacity"
          style={uiFadeStyle}
        >
          {SamplingToolbar && <SamplingToolbar />}
        </div>
        <div
          className="pointer-events-auto flex items-center justify-self-end gap-1.5 transition-opacity sm:gap-2"
          style={uiFadeStyle}
        >
          <Controls
            isActive={isActive}
            isInitializing={isInitializing}
            onRestart={() => void start()}
            onStart={() => void start()}
            onStop={() => stop()}
            transportButtonRef={transportButtonRef}
          />
        </div>
      </header>

      <SettingsPanel
        error={status.status === "error" ? status.errorMessage : null}
        sections={sectionsWithDebug}
        className="transition-opacity"
        style={uiFadeStyle}
      />

      {/* Render detection plugin's dock panel (if it has one) */}
      {DockPanel ? (
        <div className="transition-opacity" style={uiFadeStyle}>
          <DockPanel
            isRunning={isRunning}
            isInitializing={isInitializing}
            onStart={() => void start()}
            onStop={() => stop()}
            setUiOpacity={setUiOpacity}
          />
        </div>
      ) : null}

      <PipelineStatusAnnouncer status={status} />
    </main>
  );
};

export default App;
