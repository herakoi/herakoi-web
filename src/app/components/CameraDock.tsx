import { useState } from "react";
import { usePipelineStore } from "../state/pipelineStore";
import { PiPPanel, type PiPState } from "./PiPPanel";

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
  const mirror = usePipelineStore((state) => state.mirror);
  const setMirror = usePipelineStore((state) => state.setMirror);
  const maxHands = usePipelineStore((state) => state.maxHands);
  const setMaxHands = usePipelineStore((state) => state.setMaxHands);
  const facingMode = usePipelineStore((state) => state.facingMode);
  const setFacingMode = usePipelineStore((state) => state.setFacingMode);
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
