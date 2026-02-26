import { useEffect, useRef, useState } from "react";
import type { VisualizerDisplayProps } from "#src/core/plugin";
import { hsvToRgb } from "../utils";

export const DebugHudDisplay = ({ frameDataRef }: VisualizerDisplayProps) => {
  const [displayData, setDisplayData] = useState<{
    detection: { handDetected: boolean; points: Array<{ id: string; x: number; y: number }> };
    sampling: Map<string, { data: Record<string, number> }>;
    sonification: Map<
      string,
      {
        frequency: number;
        volume: number;
        hueByte: number;
        saturationByte: number;
        valueByte: number;
      }
    >;
  }>({
    detection: { handDetected: false, points: [] },
    sampling: new Map(),
    sonification: new Map(),
  });

  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const updateDisplay = () => {
      const frameData = frameDataRef.current;
      if (frameData) {
        setDisplayData({
          detection: frameData.detection,
          sampling: new Map(frameData.sampling.samples),
          sonification: new Map(frameData.sonification.tones),
        });
      }
      rafIdRef.current = requestAnimationFrame(updateDisplay);
    };

    rafIdRef.current = requestAnimationFrame(updateDisplay);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [frameDataRef]);

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(500px,45vw)] max-h-[min(320px,50vh)] overflow-y-auto overflow-x-hidden p-3 bg-black/75 text-[#32cd32] font-mono text-xs leading-relaxed z-[9999] pointer-events-none"
      style={{ wordBreak: "normal", whiteSpace: "normal" }}
    >
      {/* Detection Section */}
      <section className="mb-4">
        <h3 className="font-bold mb-2">Detection</h3>
        <div>Hands detected: {displayData.detection.handDetected ? "1" : "0"}</div>
        {displayData.detection.points.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-xs opacity-75">Normalized coords (0-1):</div>
            {displayData.detection.points.map((point) => (
              <div key={point.id}>
                {point.id}: ({point.x.toFixed(3)}, {point.y.toFixed(3)})
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sampling Section */}
      {displayData.sampling.size > 0 && (
        <section className="mb-4">
          <h3 className="font-bold mb-2">Sampling</h3>
          <div className="space-y-1">
            {Array.from(displayData.sampling.entries()).map(([id, sample]) => {
              const hueByte = sample.data.hueByte ?? 0;
              const saturationByte = sample.data.saturationByte ?? 0;
              const valueByte = sample.data.valueByte ?? 0;
              const color = hsvToRgb(hueByte, saturationByte, valueByte);
              return (
                <div key={id} className="flex items-center gap-2">
                  <span
                    className="inline-block w-4 h-4 border border-[#333]"
                    style={{ background: color }}
                  />
                  <span>
                    {id}: h {hueByte.toString().padStart(3, " ")} s{" "}
                    {saturationByte.toString().padStart(3, " ")} v{" "}
                    {valueByte.toString().padStart(3, " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Sonification Section */}
      {displayData.sonification.size > 0 && (
        <section>
          <h3 className="font-bold mb-2">Sonification</h3>
          <div className="space-y-1">
            {Array.from(displayData.sonification.entries()).map(([id, tone]) => {
              const color = hsvToRgb(tone.hueByte, tone.saturationByte, tone.valueByte);
              return (
                <div key={id} className="flex items-center gap-2">
                  <span
                    className="inline-block w-4 h-4 border border-[#333]"
                    style={{ background: color }}
                  />
                  <span>
                    {id}: {tone.frequency.toFixed(1)} Hz | vol {tone.volume.toFixed(2)} | h{" "}
                    {tone.hueByte.toString().padStart(3, " ")} s{" "}
                    {tone.saturationByte.toString().padStart(3, " ")} v{" "}
                    {tone.valueByte.toString().padStart(3, " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {displayData.detection.points.length === 0 &&
        displayData.sampling.size === 0 &&
        displayData.sonification.size === 0 && (
          <div>No data yet. Start the engine and move your hand in front of the camera.</div>
        )}
    </div>
  );
};
