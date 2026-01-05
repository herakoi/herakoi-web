import { useState } from "react";
import { usePipelineStore } from "../state/pipelineStore";
import { PiPPanel, type PiPState } from "./PiPPanel";

type CameraDockProps = {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
  onStart: () => void;
  onStop: () => void;
};

export const CameraDock = ({ videoRef, overlayRef, onStart, onStop }: CameraDockProps) => {
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
      pip={pip}
      setPip={setPip}
      videoRef={videoRef}
      overlayRef={overlayRef}
    />
  );
};
