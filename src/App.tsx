import { useEffect, useRef, useState } from "react";
import { EngineStatusAnnouncer } from "./components/EngineStatusAnnouncer";
import { BrandMark } from "./components/header/BrandMark";
import { Controls } from "./components/header/Controls";
import { NotificationArea } from "./components/NotificationArea";
import { SettingsPanel } from "./components/SettingsPanel";
import { engineConfig } from "./engineConfig";
import { usePluginUi } from "./hooks/plugin";
import { useIdleDimmer, useUiDimFade } from "./hooks/ui";
import { useSonificationEngine } from "./hooks/useSonificationEngine";
import { useUiPreferences } from "./state/appConfigStore";

const App = () => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);
  const transportButtonRef = useRef<HTMLButtonElement>(null);

  const {
    startTransport,
    stopTransport,
    engineStatus,
    transportStatus,
    analyser,
    visualizerFrameDataRef,
  } = useSonificationEngine(engineConfig, {
    imageCanvasRef,
    imageOverlayRef,
  });
  const [uiPrefs] = useUiPreferences();
  const dimLogoMark = uiPrefs.dimLogoMark;

  // Idle dimming: dim UI after idle when points are detected
  useIdleDimmer({ baseOpacity: uiPrefs.baseUiOpacity });

  const { sections, SamplingToolbar, DockPanel, VisualizerDisplays, PluginNotificationComponents } =
    usePluginUi({
      config: engineConfig,
      startTransport,
      stopTransport,
    });

  const isRunning = transportStatus.status === "running";
  const isInitializing = engineStatus === "initializing";
  const isActive = isRunning || isInitializing;

  const { uiFadeStyle, uiDimmed } = useUiDimFade();
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);

  useEffect(() => {
    if (!autoStartEnabled) return;
    if (engineStatus !== "ready") return;
    if (transportStatus.status !== "stopped") return;
    void startTransport();
  }, [autoStartEnabled, engineStatus, startTransport, transportStatus.status]);

  return (
    <main className="relative min-h-screen touch-none overscroll-none overflow-hidden bg-background text-foreground">
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
          className="h-full w-full touch-none"
          role="img"
          aria-label="Herakoi audio-visualizer output"
        />
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: Overlay canvas is decorative and not interactive */}
        <canvas
          ref={imageOverlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        {/* cos è sto div?? */}
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

      <NotificationArea>
        {PluginNotificationComponents.map(({ id, Notifications }) => (
          <Notifications key={id} />
        ))}
      </NotificationArea>

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
            onRestart={() => {
              setAutoStartEnabled(true);
              stopTransport();
              void startTransport();
            }}
            onStart={() => {
              setAutoStartEnabled(true);
              void startTransport();
            }}
            onStop={() => {
              setAutoStartEnabled(false);
              stopTransport();
            }}
            transportButtonRef={transportButtonRef}
          />
        </div>
      </header>

      <SettingsPanel sections={sections} className="transition-opacity" style={uiFadeStyle} />

      {/* Render detection plugin's dock panel (if it has one) */}
      {DockPanel ? (
        <div className="transition-opacity" style={uiFadeStyle}>
          <DockPanel
            isRunning={isRunning}
            isInitializing={isInitializing}
            onStart={() => {
              setAutoStartEnabled(true);
              void startTransport();
            }}
            onStop={() => {
              setAutoStartEnabled(false);
              stopTransport();
            }}
          />
        </div>
      ) : null}

      {/* Render active visualizer displays (outside dimmer) */}
      {VisualizerDisplays.map(({ id, Display }) => (
        <Display key={id} isRunning={isRunning} frameDataRef={visualizerFrameDataRef} />
      ))}

      <EngineStatusAnnouncer engineStatus={engineStatus} transportStatus={transportStatus} />
    </main>
  );
};

export default App;
