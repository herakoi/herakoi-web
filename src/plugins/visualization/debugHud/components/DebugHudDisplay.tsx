import { useEffect, useRef, useState } from "react";
import type { VisualizerDisplayProps } from "#src/core/plugin";
import { useT } from "../i18n";
import { hsvToRgb } from "../utils";
import styles from "./DebugHudDisplay.module.css";

export const DebugHudDisplay = ({ frameDataRef }: VisualizerDisplayProps) => {
  const t = useT();
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
    <div className={styles.hud}>
      {/* Detection Section */}
      <section className={styles.section}>
        <h3 className={styles.title}>{t("section.detection")}</h3>
        <div>{t("handsDetected", { count: displayData.detection.handDetected ? 1 : 0 })}</div>
        {displayData.detection.points.length > 0 && (
          <div className={styles.points}>
            <div className={styles.caption}>{t("normalizedCoords")}</div>
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
        <section className={styles.section}>
          <h3 className={styles.title}>{t("section.sampling")}</h3>
          <div className={styles.list}>
            {Array.from(displayData.sampling.entries()).map(([id, sample]) => {
              const hueByte = sample.data.hueByte ?? 0;
              const saturationByte = sample.data.saturationByte ?? 0;
              const valueByte = sample.data.valueByte ?? 0;
              const color = hsvToRgb(hueByte, saturationByte, valueByte);
              return (
                <div key={id} className={styles.row}>
                  <span className={styles.swatch} style={{ background: color }} />
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
          <h3 className={styles.title}>{t("section.sonification")}</h3>
          <div className={styles.list}>
            {Array.from(displayData.sonification.entries()).map(([id, tone]) => {
              const color = hsvToRgb(tone.hueByte, tone.saturationByte, tone.valueByte);
              return (
                <div key={id} className={styles.row}>
                  <span className={styles.swatch} style={{ background: color }} />
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
        displayData.sonification.size === 0 && <div>{t("noData")}</div>}
    </div>
  );
};
