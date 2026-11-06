import { Maximize, Minimize } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import { EngineStatusAnnouncer } from "./components/EngineStatusAnnouncer";
import { BrandMark } from "./components/header/BrandMark";
import { Controls } from "./components/header/Controls";
import { ModeToggle, type ModeToggleOption } from "./components/ModeToggle";
import { NotificationArea } from "./components/NotificationArea";
import { SettingsPanel } from "./components/SettingsPanel";
import { engineConfig } from "./engineConfig";
import { usePluginSwitch, usePluginUi } from "./hooks/plugin";
import { useIdleDimmer, useUiDimFade } from "./hooks/ui";
import { useSonificationEngine } from "./hooks/useSonificationEngine";
import { shellT, useShellT } from "./i18n/shell";
import { PluginNotification } from "./shared/components/notifications/PluginNotification";
import { usePluginName } from "./shared/i18n";
import { useUiPreferences } from "./state/appConfigStore";

type ModePlugin = { id: string; displayName: string; icon?: ModeToggleOption["icon"] };

/** Plugins that declare an icon appear in the quick mode switch, named as in Settings. */
const toModeOptions = (
  plugins: ReadonlyArray<ModePlugin>,
  pluginName: (plugin: ModePlugin) => string,
): ModeToggleOption[] =>
  plugins.flatMap((plugin) =>
    plugin.icon ? [{ pluginId: plugin.id, label: pluginName(plugin), icon: plugin.icon }] : [],
  );

const App = () => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);
  const transportButtonRef = useRef<HTMLButtonElement>(null);

  const {
    startTransport,
    stopTransport,
    restartEngine,
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

  const {
    sections,
    SamplingToolbar,
    SonificationPanel,
    DockPanel,
    VisualizerDisplays,
    PluginNotificationComponents,
  } = usePluginUi({
    config: engineConfig,
    stopTransport,
  });

  const t = useShellT();
  const pluginName = usePluginName();
  const detectionModes = useMemo(
    () => toModeOptions(engineConfig.detection, pluginName),
    [pluginName],
  );
  const sonificationModes = useMemo(
    () => toModeOptions(engineConfig.sonification, pluginName),
    [pluginName],
  );
  const switchDetection = usePluginSwitch("detection", { stopTransport });
  const switchSonification = usePluginSwitch("sonification", { stopTransport });

  const isRunning = transportStatus.status === "running";
  const isInitializing = engineStatus === "initializing";
  const isActive = isRunning || isInitializing;

  const { uiFadeStyle, uiDimmed } = useUiDimFade();
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenAvailable =
    typeof document !== "undefined" && Boolean(document.fullscreenEnabled);
  const [fullscreenNotice, setFullscreenNotice] = useState<{
    message: string;
    icon: typeof Maximize | typeof Minimize;
  } | null>(null);
  const fullscreenNoticeTimeoutRef = useRef<number | null>(null);
  const fullscreenSyncReadyRef = useRef(false);
  const previousFullscreenRef = useRef(false);

  const showFullscreenNotice = useCallback(
    (notice: { message: string; icon: typeof Maximize | typeof Minimize }) => {
      if (typeof window === "undefined") return;
      if (fullscreenNoticeTimeoutRef.current) {
        window.clearTimeout(fullscreenNoticeTimeoutRef.current);
      }
      setFullscreenNotice(notice);
      fullscreenNoticeTimeoutRef.current = window.setTimeout(() => {
        setFullscreenNotice(null);
        fullscreenNoticeTimeoutRef.current = null;
      }, 2200);
    },
    [],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncFullscreenState = () => {
      const nextFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(nextFullscreen);
      if (!fullscreenSyncReadyRef.current) {
        fullscreenSyncReadyRef.current = true;
        previousFullscreenRef.current = nextFullscreen;
        return;
      }
      if (nextFullscreen === previousFullscreenRef.current) return;
      previousFullscreenRef.current = nextFullscreen;
      showFullscreenNotice(
        nextFullscreen
          ? {
              message: shellT("app.fullscreenOn"),
              icon: Maximize,
            }
          : {
              message: shellT("app.fullscreenOff"),
              icon: Minimize,
            },
      );
    };
    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, [showFullscreenNotice]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      if (fullscreenNoticeTimeoutRef.current) {
        window.clearTimeout(fullscreenNoticeTimeoutRef.current);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    void document.documentElement.requestFullscreen().catch(() => {});
  };

  const handleShellDoubleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea, [role='button']")) {
      return;
    }
    toggleFullscreen();
  };

  useEffect(() => {
    if (!autoStartEnabled) return;
    if (engineStatus !== "ready") return;
    if (transportStatus.status !== "stopped") return;
    void startTransport();
  }, [autoStartEnabled, engineStatus, startTransport, transportStatus.status]);

  // On mobile, the browser suspends JS execution when a tab goes to background.
  // The camera stream is killed by the OS, but React state is frozen too, so
  // transportStatus may still read "running" when the tab resumes — the async
  // iterator hasn't had a chance to throw yet. We therefore restart
  // unconditionally (restartEngine handles a running transport gracefully).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      if (!autoStartEnabled) return;
      if (engineStatus === "initializing") return;
      restartEngine();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [autoStartEnabled, engineStatus, restartEngine]);

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: double-click for fullscreen is a pointer shortcut; the header has a fullscreen button and the canvas hint announces the gesture.
    <main className={styles.main} onDoubleClick={handleShellDoubleClick}>
      <a href="#herakoi-main-canvas" className={styles.skipLink}>
        {t("app.skipToContent")}
      </a>
      <div className={styles.canvasLayer}>
        <canvas
          ref={imageCanvasRef}
          id="herakoi-main-canvas"
          tabIndex={-1}
          className={styles.canvas}
          role="img"
          aria-label={t("app.canvas")}
          aria-describedby={fullscreenAvailable ? "herakoi-canvas-hint" : undefined}
        />
        {fullscreenAvailable ? (
          <span id="herakoi-canvas-hint" className={styles.hint}>
            {t("app.canvasHint")}
          </span>
        ) : null}
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: Overlay canvas is decorative and not interactive */}
        <canvas ref={imageOverlayRef} className={styles.overlay} aria-hidden="true" />
        <div
          className={styles.gradient}
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
        {fullscreenNotice ? (
          <PluginNotification message={fullscreenNotice.message} icon={fullscreenNotice.icon} />
        ) : null}
        {PluginNotificationComponents.map(({ id, Notifications }) => (
          <Notifications key={id} />
        ))}
      </NotificationArea>

      <header className={styles.header}>
        <div className={styles.headerStart}>
          <BrandMark
            analyserRef={analyser}
            dimLogoMark={dimLogoMark}
            uiFadeStyle={uiFadeStyle}
            logoRef={logoRef}
          />
        </div>
        <div className={styles.toolbar} style={uiFadeStyle}>
          {SamplingToolbar && <SamplingToolbar />}
        </div>
        <div className={styles.headerEnd} style={uiFadeStyle}>
          <Controls
            isActive={isActive}
            isInitializing={isInitializing}
            onStart={() => {
              setAutoStartEnabled(true);
              void startTransport();
            }}
            onStop={() => {
              setAutoStartEnabled(false);
              stopTransport();
            }}
            isFullscreen={isFullscreen}
            fullscreenAvailable={fullscreenAvailable}
            onToggleFullscreen={toggleFullscreen}
            transportButtonRef={transportButtonRef}
          />
        </div>
      </header>

      <div className={styles.detectionRail} style={uiFadeStyle}>
        <ModeToggle
          slot="detection"
          label={t("modeToggle.detection")}
          options={detectionModes}
          onSelect={switchDetection}
          orientation="responsive"
        />
      </div>

      <SettingsPanel sections={sections} className={styles.fade} style={uiFadeStyle} />
      <div className={styles.sonificationRail} style={uiFadeStyle}>
        <ModeToggle
          slot="sonification"
          label={t("modeToggle.sonification")}
          options={sonificationModes}
          onSelect={switchSonification}
          orientation="vertical"
        />
        {SonificationPanel ? <SonificationPanel /> : null}
      </div>

      {/* Render detection plugin's dock panel (if it has one) */}
      {DockPanel ? (
        <div className={styles.fade} style={uiFadeStyle}>
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
