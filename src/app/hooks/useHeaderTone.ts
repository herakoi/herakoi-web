import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

type Tone = "light" | "dark";

type UseHeaderToneArgs = {
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  logoRef: RefObject<HTMLElement>;
  coverButtonRef: RefObject<HTMLButtonElement>;
  transportButtonRef: RefObject<HTMLButtonElement>;
};

export const useHeaderTone = ({
  imageCanvasRef,
  logoRef,
  coverButtonRef,
  transportButtonRef,
}: UseHeaderToneArgs) => {
  const logoSampleRef = useRef<HTMLCanvasElement | null>(null);
  const headerToneRafRef = useRef<number | null>(null);
  const [logoTone, setLogoTone] = useState<Tone>("light");
  const [coverTone, setCoverTone] = useState<Tone>("light");
  const [transportTone, setTransportTone] = useState<Tone>("light");

  const sampleElementTone = useCallback(
    (element: HTMLElement | null) => {
      const canvas = imageCanvasRef.current;
      if (!canvas || !element) return null;

      const canvasRect = canvas.getBoundingClientRect();
      const targetRect = element.getBoundingClientRect();
      if (canvasRect.width === 0 || canvasRect.height === 0) return null;

      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      const sx = Math.max(0, Math.floor((targetRect.left - canvasRect.left) * scaleX));
      const sy = Math.max(0, Math.floor((targetRect.top - canvasRect.top) * scaleY));
      const sw = Math.min(canvas.width - sx, Math.floor(targetRect.width * scaleX));
      const sh = Math.min(canvas.height - sy, Math.floor(targetRect.height * scaleY));
      if (sw <= 0 || sh <= 0) return null;

      const sampleCanvas = logoSampleRef.current ?? document.createElement("canvas");
      logoSampleRef.current = sampleCanvas;
      const sampleW = Math.max(12, Math.min(64, sw));
      const sampleH = Math.max(12, Math.min(32, sh));
      sampleCanvas.width = sampleW;
      sampleCanvas.height = sampleH;

      const sampleCtx = sampleCanvas.getContext("2d");
      if (!sampleCtx) return null;
      sampleCtx.clearRect(0, 0, sampleW, sampleH);
      sampleCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sampleW, sampleH);
      const data = sampleCtx.getImageData(0, 0, sampleW, sampleH).data;
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        total += data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      }
      const avg = total / (255 * (data.length / 4));
      return avg > 0.62 ? "dark" : "light";
    },
    [imageCanvasRef],
  );

  const updateHeaderTones = useCallback(() => {
    const nextLogoTone = sampleElementTone(logoRef.current);
    if (nextLogoTone) {
      setLogoTone((prev) => (prev === nextLogoTone ? prev : nextLogoTone));
    }

    const nextCoverTone = sampleElementTone(coverButtonRef.current);
    if (nextCoverTone) {
      setCoverTone((prev) => (prev === nextCoverTone ? prev : nextCoverTone));
    }

    const nextTransportTone = sampleElementTone(transportButtonRef.current);
    if (nextTransportTone) {
      setTransportTone((prev) => (prev === nextTransportTone ? prev : nextTransportTone));
    }
  }, [coverButtonRef, logoRef, sampleElementTone, transportButtonRef]);

  useEffect(() => {
    if (headerToneRafRef.current !== null) {
      cancelAnimationFrame(headerToneRafRef.current);
    }
    headerToneRafRef.current = requestAnimationFrame(() => {
      headerToneRafRef.current = null;
      updateHeaderTones();
    });
    return () => {
      if (headerToneRafRef.current !== null) {
        cancelAnimationFrame(headerToneRafRef.current);
        headerToneRafRef.current = null;
      }
    };
  }, [updateHeaderTones]);

  useEffect(() => {
    const handleResize = () => {
      if (headerToneRafRef.current !== null) return;
      headerToneRafRef.current = requestAnimationFrame(() => {
        headerToneRafRef.current = null;
        updateHeaderTones();
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateHeaderTones]);

  useEffect(() => {
    const handleImageRendered = () => {
      if (headerToneRafRef.current !== null) return;
      headerToneRafRef.current = requestAnimationFrame(() => {
        headerToneRafRef.current = null;
        updateHeaderTones();
      });
    };
    window.addEventListener("herakoi-image-rendered", handleImageRendered);
    return () => window.removeEventListener("herakoi-image-rendered", handleImageRendered);
  }, [updateHeaderTones]);

  return { logoTone, coverTone, transportTone };
};
