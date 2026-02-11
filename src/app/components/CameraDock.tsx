/**
 * @deprecated This file is deprecated. The camera dock is now provided by the
 * detection plugin itself. See src/detection/mediapipe/components/DockPanel.tsx
 * for the MediaPipe detection plugin's dock panel.
 *
 * This file remains for historical reference only and should not be imported.
 */

import { useState } from "react";
import { useMediaPipeDetectionStore } from "#src/detection/mediapipe/store";
import { usePipelineStore } from "../state/pipelineStore";
import { PiPPanel, type PiPState } from "./PiPPanel";

/**
 * @deprecated Use detection plugin's DockPanel instead
 */
type CameraDockProps = {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
  onStart: () => void;
  onStop: () => void;
  cameraTone: "light" | "dark";
  cameraSelectTone: "light" | "dark";
  cameraToggleRef: React.RefObject<HTMLButtonElement>;
  cameraSelectRef: React.RefObject<HTMLButtonElement>;
};

/**
 * @deprecated Use detection plugin's DockPanel instead
 */
export const CameraDock = ({
  videoRef,
  overlayRef,
  onStart,
  onStop,
  cameraTone,
  cameraSelectTone,
  cameraToggleRef,
  cameraSelectRef,
}: CameraDockProps) => {
  const mirror = useMediaPipeDetectionStore((state) => state.mirror);
  const setMirror = useMediaPipeDetectionStore((state) => state.setMirror);
  const maxHands = useMediaPipeDetectionStore((state) => state.maxHands);
  const setMaxHands = useMediaPipeDetectionStore((state) => state.setMaxHands);
  const facingMode = useMediaPipeDetectionStore((state) => state.facingMode);
  const setFacingMode = useMediaPipeDetectionStore((state) => state.setFacingMode);
  const status = usePipelineStore((state) => state.status);
  const isRunning = status === "running";
  const isInitializing = status === "initializing";
  const [pip, setPip] = useState<PiPState>({
    x: 16,
    y: 16,
    width: 260,
  });
  const [pipOpen, setPipOpen] = useState(true);

  return (
    <PiPPanel
      open={pipOpen}
      onToggle={() => setPipOpen((prev) => !prev)}
      mirror={mirror}
      isRunning={isRunning}
      isInitializing={isInitializing}
      onStart={onStart}
      onStop={onStop}
      onMirrorToggle={() => setMirror(!mirror)}
      maxHands={maxHands}
      onMaxHandsChange={setMaxHands}
      facingMode={facingMode}
      onFacingModeChange={setFacingMode}
      cameraTone={cameraTone}
      cameraSelectTone={cameraSelectTone}
      cameraToggleRef={cameraToggleRef}
      cameraSelectRef={cameraSelectRef}
      pip={pip}
      setPip={setPip}
      videoRef={videoRef}
      overlayRef={overlayRef}
    />
  );
};
