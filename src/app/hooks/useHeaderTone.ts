import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

type Tone = "light" | "dark";

export type ToneTarget = {
  key: string;
  ref: RefObject<HTMLElement>;
};

type RegionLuminanceFn = (x: number, y: number, w: number, h: number) => number | null;

type UseHeaderToneArgs = {
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  logoRef: RefObject<HTMLElement>;
  transportButtonRef: RefObject<HTMLButtonElement>;
  extraTargets?: ToneTarget[];
  samplerExtrasRef?: RefObject<Record<string, unknown> | null>;
};

function getElementCoordinatesOverCanvas(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
): { x: number; y: number; w: number; h: number } | null {
  const canvasRect = canvas.getBoundingClientRect();
  const targetRect = element.getBoundingClientRect();
  if (canvasRect.width === 0 || canvasRect.height === 0) return null;

  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;
  const x = Math.max(0, Math.floor((targetRect.left - canvasRect.left) * scaleX));
  const y = Math.max(0, Math.floor((targetRect.top - canvasRect.top) * scaleY));
  const w = Math.min(canvas.width - x, Math.floor(targetRect.width * scaleX));
  const h = Math.min(canvas.height - y, Math.floor(targetRect.height * scaleY));
  if (w <= 0 || h <= 0) return null;

  return { x, y, w, h };
}

function decideLuminanceContrast(luminance: number | null): Tone | null {
  if (luminance === null) return null;
  return luminance > 0.62 ? "dark" : "light";
}

export const useHeaderTone = ({
  imageCanvasRef,
  logoRef,
  transportButtonRef,
  extraTargets,
  samplerExtrasRef,
}: UseHeaderToneArgs) => {
  const headerToneRafRef = useRef<number | null>(null);
  const [logoTone, setLogoTone] = useState<Tone>("light");
  const [transportTone, setTransportTone] = useState<Tone>("light");
  const [extraTones, setExtraTones] = useState<Record<string, Tone>>(() => {
    if (!extraTargets?.length) return {};
    return Object.fromEntries(extraTargets.map(({ key }) => [key, "light"]));
  });

  useEffect(() => {
    if (!extraTargets?.length) return;
    setExtraTones((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { key } of extraTargets) {
        if (!(key in next)) {
          next[key] = "light";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [extraTargets]);

  const resolveElementContrast = useCallback(
    (element: HTMLElement | null) => {
      const canvas = imageCanvasRef.current;
      if (!canvas || !element) return null;

      const region = getElementCoordinatesOverCanvas(canvas, element);
      if (!region) return null;

      const regionLuminance = samplerExtrasRef?.current?.regionLuminance as
        | RegionLuminanceFn
        | undefined;
      if (!regionLuminance) return null;

      return decideLuminanceContrast(regionLuminance(region.x, region.y, region.w, region.h));
    },
    [imageCanvasRef, samplerExtrasRef],
  );

  const updateHeaderTones = useCallback(() => {
    const nextLogoTone = resolveElementContrast(logoRef.current);
    if (nextLogoTone) {
      setLogoTone((prev) => (prev === nextLogoTone ? prev : nextLogoTone));
    }

    const nextTransportTone = resolveElementContrast(transportButtonRef.current);
    if (nextTransportTone) {
      setTransportTone((prev) => (prev === nextTransportTone ? prev : nextTransportTone));
    }

    if (extraTargets?.length) {
      setExtraTones((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const { key, ref } of extraTargets) {
          const nextTone = resolveElementContrast(ref.current);
          if (!nextTone) continue;
          if (next[key] !== nextTone) {
            next[key] = nextTone;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [extraTargets, logoRef, resolveElementContrast, transportButtonRef]);

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

  return { logoTone, transportTone, extraTones };
};
