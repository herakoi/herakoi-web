import { type RefObject, useEffect, useMemo, useRef } from "react";
import { type SunburstConfig, SunburstMark } from "../lib/SunburstMark";

type Props = {
  analyserRef: RefObject<AnalyserNode | null>;
  size: number;
  className?: string;
  tone?: "light" | "dark";
};

const makeConfig = (size: number, tone: "light" | "dark"): SunburstConfig => {
  const maxRadius = size * 0.495;
  const coreRadius = size * 0.048;
  const rayGap = size * 0.04;
  const baseLen = size * 0.11;
  const reactLen = Math.max(0, maxRadius - (coreRadius + rayGap + baseLen));

  return {
    bg: "rgba(0,0,0,0)",
    rayColor: tone === "dark" ? "rgba(30,30,30,0.9)" : "rgba(255,255,255,0.97)",
    rays: 24,
    coreRadius,
    coreColor: "rgba(0,0,0,0)",
    rayGap,
    rayWidth: Math.max(0.75, size * 0.016),
    baseLen,
    reactLen,
    noiseFloor: 0.03,
    gain: 1.55,
    gamma: 1.05,
    attack: 0.35,
    release: 0.9,
    circularBlurPasses: 2,
    rotate: false,
    rotateSpeed: 0,
    baseWaveStrength: 0.34,
    baseWaveWidthRays: 8,
    propagateStrength: 1.15,
    propagateSpeed: 0.14,
    propagateSharpness: 3,
  };
};

export function ReactiveMark({ analyserRef, size, className, tone = "light" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const mark = useMemo(() => new SunburstMark(makeConfig(size, tone)), [size, tone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let rafId = 0;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mark.updateConfig(makeConfig(size, tone));
    };

    const drawStatic = () => {
      mark.draw(ctx, size, size, null, "spectrum");
    };

    const loop = () => {
      const nextAnalyser = analyserRef.current;
      let analysis: Uint8Array<ArrayBuffer> | null = null;

      if (nextAnalyser) {
        const bins = nextAnalyser.frequencyBinCount;
        if (!scratchRef.current || scratchRef.current.length !== bins) {
          scratchRef.current = new Uint8Array(bins);
        }
        nextAnalyser.getByteFrequencyData(scratchRef.current);
        analysis = scratchRef.current;
      }

      mark.draw(ctx, size, size, analysis, "spectrum");
      rafId = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      cancelAnimationFrame(rafId);
      if (motionQuery.matches) {
        drawStatic();
      } else {
        rafId = requestAnimationFrame(loop);
      }
    };

    resize();
    startLoop();

    motionQuery.addEventListener("change", startLoop);
    return () => {
      cancelAnimationFrame(rafId);
      motionQuery.removeEventListener("change", startLoop);
    };
  }, [analyserRef, mark, size, tone]);

  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: Decorative canvas is not interactive
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
