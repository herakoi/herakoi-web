import { Bug } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useImageCoverPan } from "#src/sampling/hsv/hooks/useImageCoverPan";
import { ControlPanel, type ControlPanelSection } from "./components/ControlPanel";
import { BrandMark } from "./components/header/BrandMark";
import { TransportControls } from "./components/header/TransportControls";
import { PluginNotifications } from "./components/PluginNotifications";
import { PluginSelector } from "./components/PluginSelector";
import { DebugPanel } from "./components/panels/DebugPanel";
import { ScreenReaderAnnouncer } from "./components/ScreenReaderAnnouncer";
import { usePipeline } from "./hooks/usePipeline";
import { useUiDimFade } from "./hooks/useUiDimFade";
import { pipelineConfig } from "./pipelineConfig";
import { usePipelineStore } from "./state/pipelineStore";

const App = () => {
  type PanelKey = string; // Dynamic based on plugins

  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);
  const transportButtonRef = useRef<HTMLButtonElement>(null);

  const { start, stop, status, error, analyser } = usePipeline(pipelineConfig, {
    imageCanvasRef,
    imageOverlayRef,
  });
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const setUiOpacity = usePipelineStore((state) => state.setUiOpacity);
  const dimLogoMark = usePipelineStore((state) => state.dimLogoMark);

  const activeDetectionId = usePipelineStore((state) => state.activeDetectionId);
  const setActiveDetectionId = usePipelineStore((state) => state.setActiveDetectionId);
  const activeSamplingId = usePipelineStore((state) => state.activeSamplingId);
  const setActiveSamplingId = usePipelineStore((state) => state.setActiveSamplingId);
  const activeSonificationId = usePipelineStore((state) => state.activeSonificationId);
  const setActiveSonificationId = usePipelineStore((state) => state.setActiveSonificationId);

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

  const { uiFadeStyle, uiDimmed } = useUiDimFade();

  // Plugin-owned cover/pan interaction on the image canvas
  useImageCoverPan();

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  // Resolve active sampling plugin for toolbar
  const activeSampling = pipelineConfig.sampling.find((p) => p.id === activeSamplingId);
  const SamplingToolbar = activeSampling?.ui.ToolbarItems;

  // Build sections dynamically from plugins
  const sections: ControlPanelSection<PanelKey>[] = useMemo(() => {
    const pluginSections: ControlPanelSection<PanelKey>[] = [];

    // Sonification plugin settings
    const activeSonification = pipelineConfig.sonification.find(
      (p) => p.id === activeSonificationId,
    );
    if (activeSonification?.settingsTab && activeSonification.ui.SettingsPanel) {
      const Panel = activeSonification.ui.SettingsPanel;
      pluginSections.push({
        key: activeSonification.settingsTab.key,
        label: activeSonification.settingsTab.label,
        icon: activeSonification.settingsTab.icon,
        render: () => (
          <>
            <PluginSelector
              label="Sonification"
              plugins={pipelineConfig.sonification.map((p) => ({
                id: p.id,
                displayName: p.displayName,
              }))}
              activeId={activeSonificationId}
              onSelect={(id) => {
                stop();
                setActiveSonificationId(id);
                void start();
              }}
            />
            <Panel />
          </>
        ),
      });
    }

    // Sampling plugin settings
    const activeSamplingPlugin = pipelineConfig.sampling.find((p) => p.id === activeSamplingId);
    if (activeSamplingPlugin?.settingsTab) {
      const Panel = activeSamplingPlugin.ui.SettingsPanel;
      pluginSections.push({
        key: activeSamplingPlugin.settingsTab.key,
        label: activeSamplingPlugin.settingsTab.label,
        icon: activeSamplingPlugin.settingsTab.icon,
        render: () => (
          <>
            <PluginSelector
              label="Sampling"
              plugins={pipelineConfig.sampling.map((p) => ({
                id: p.id,
                displayName: p.displayName,
              }))}
              activeId={activeSamplingId}
              onSelect={(id) => {
                stop();
                setActiveSamplingId(id);
                void start();
              }}
            />
            {Panel && <Panel />}
          </>
        ),
      });
    }

    // Detection plugin settings
    const activeDetection = pipelineConfig.detection.find((p) => p.id === activeDetectionId);
    if (activeDetection?.settingsTab && activeDetection.ui.SettingsPanel) {
      const Panel = activeDetection.ui.SettingsPanel;
      pluginSections.push({
        key: activeDetection.settingsTab.key,
        label: activeDetection.settingsTab.label,
        icon: activeDetection.settingsTab.icon,
        render: () => (
          <>
            <PluginSelector
              label="Detection"
              plugins={pipelineConfig.detection.map((p) => ({
                id: p.id,
                displayName: p.displayName,
              }))}
              activeId={activeDetectionId}
              onSelect={(id) => {
                stop();
                setActiveDetectionId(id);
                void start();
              }}
            />
            <Panel />
          </>
        ),
      });
    }

    // Debug panel (always present)
    pluginSections.push({
      key: "debug",
      label: "Debug",
      icon: <Bug className="h-3.5 w-3.5" />,
      render: () => <DebugPanel />,
    });

    return pluginSections;
  }, [
    activeSonificationId,
    activeSamplingId,
    activeDetectionId,
    setActiveSonificationId,
    setActiveSamplingId,
    setActiveDetectionId,
    start,
    stop,
  ]);

  // Render active detection plugin's dock panel
  const activeDetection = pipelineConfig.detection.find((p) => p.id === activeDetectionId);
  const DockPanel = activeDetection?.ui.DockPanel;

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
          <TransportControls
            isActive={isActive}
            isInitializing={isInitializing}
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

      <ScreenReaderAnnouncer message={statusAnnouncement} politeness="assertive" />
    </main>
  );
};

export default App;
