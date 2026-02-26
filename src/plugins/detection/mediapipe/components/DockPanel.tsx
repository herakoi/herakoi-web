import { useMemo, useRef, useState } from "react";
import type { DockPanelProps } from "#src/core/plugin";
import { Floating } from "#src/shared/components/Floating";
import type { MediaPipeConfig } from "../config";
import { useDeviceStore } from "../deviceStore";
import { useMediaPipeDockBindings } from "../hooks/useMediaPipeDockBindings";
import { DockPanelControls } from "./DockPanelControls";
import { DockPanelPiPActions } from "./DockPanelPiPActions";
import { DockPanelPiPSurface } from "./DockPanelPiPSurface";
import { DockPanelPiPTransport } from "./DockPanelPiPTransport";

export const MediaPipeDockPanel = ({
  isRunning,
  isInitializing,
  onStart,
  onStop,
  config,
  setConfig,
}: DockPanelProps<MediaPipeConfig>) => {
  const { maxHands } = config;
  const devices = useDeviceStore((s) => s.devices);
  const deviceId = useDeviceStore((s) => s.deviceId);
  const mirror = useDeviceStore((s) => s.mirror);
  const setDeviceId = useDeviceStore((s) => s.setDeviceId);
  const setMirror = useDeviceStore((s) => s.setMirror);
  const restartCamera = useDeviceStore((s) => s.restartCamera);

  const { videoRef, overlayRef, videoReady, videoAspectRatio } = useMediaPipeDockBindings();
  const controlsRef = useRef<HTMLDivElement>(null);
  const [pipOpen, setPipOpen] = useState(true);
  const initialPipLayout = useMemo(
    () => ({
      x: 16,
      y: typeof window === "undefined" ? 10_000 : window.innerHeight,
      width: 260,
    }),
    [],
  );
  const isActive = isRunning || isInitializing;

  return (
    <div className="fixed bottom-3 left-2 z-10 flex flex-col gap-2 sm:bottom-4 sm:left-4">
      <div ref={controlsRef}>
        <DockPanelControls
          pipOpen={pipOpen}
          deviceId={deviceId}
          devices={devices}
          restartCamera={restartCamera}
          onTogglePip={() => setPipOpen((prev) => !prev)}
          onDeviceChange={setDeviceId}
        />
      </div>
      <Floating
        open={pipOpen}
        initial={initialPipLayout}
        aspectRatio={videoAspectRatio}
        minWidth={180}
        padding={4}
        forbiddenGap={12}
        forbiddenRefs={[controlsRef]}
        moveHandleAriaLabel="Move picture-in-picture window"
      >
        {({
          isResizing,
          onMovePointerDown,
          onMoveKeyDown,
          onResizePointerDown,
          onResizeKeyDown,
        }) => (
          <DockPanelPiPSurface
            videoRef={videoRef}
            overlayRef={overlayRef}
            isRunning={isRunning}
            mirror={mirror}
            videoReady={videoReady}
            aspectRatio={videoAspectRatio}
          >
            <button
              type="button"
              aria-label="Move picture-in-picture window"
              className="absolute inset-0 z-10 cursor-move border-none bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              onPointerDown={onMovePointerDown}
              onKeyDown={onMoveKeyDown}
            />
            <DockPanelPiPTransport
              isRunning={isRunning}
              isInitializing={isInitializing}
              isActive={isActive}
              onStart={onStart}
              onStop={onStop}
            />
            <DockPanelPiPActions
              mirror={mirror}
              maxHands={maxHands}
              isResizing={isResizing}
              onHide={() => setPipOpen(false)}
              onToggleMirror={() => setMirror(!mirror)}
              onCycleMaxHands={() => setConfig({ maxHands: maxHands >= 4 ? 1 : maxHands + 1 })}
              onResizePointerDown={onResizePointerDown}
              onResizeKeyDown={onResizeKeyDown}
            />
          </DockPanelPiPSurface>
        )}
      </Floating>
    </div>
  );
};
