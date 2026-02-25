import type { SonifierHandle, VisualizerFrameData } from "#src/core/plugin";

const resolveLastFrameDebugGetter = (
  sonifierHandle: SonifierHandle | null,
): (() => VisualizerFrameData["sonification"]["tones"]) | null => {
  const candidate = sonifierHandle?.extras?.getLastFrameDebug;
  if (typeof candidate !== "function") return null;
  return candidate as () => VisualizerFrameData["sonification"]["tones"];
};

export const updateSonificationDebugFrame = (params: {
  sonifierHandleRef: { current: SonifierHandle | null };
  visualizerFrameDataRef: { current: VisualizerFrameData };
}) => {
  const { sonifierHandleRef, visualizerFrameDataRef } = params;
  const getLastFrameDebug = resolveLastFrameDebugGetter(sonifierHandleRef.current);
  if (!getLastFrameDebug) return;

  visualizerFrameDataRef.current.sonification = {
    tones: getLastFrameDebug(),
  };
};

export const initializeAnalyserForVisualizer = (params: {
  sonifierHandleRef: { current: SonifierHandle | null };
  analyserRef: { current: AnalyserNode | null };
  visualizerFrameDataRef: { current: VisualizerFrameData };
  options?: {
    fftSize?: number;
    smoothingTimeConstant?: number;
  };
}) => {
  const { sonifierHandleRef, analyserRef, visualizerFrameDataRef, options } = params;
  const getAnalyser = sonifierHandleRef.current?.extras?.getAnalyser;
  if (typeof getAnalyser !== "function") return;

  analyserRef.current = (
    getAnalyser as (opts?: {
      fftSize?: number;
      smoothingTimeConstant?: number;
    }) => AnalyserNode | null
  )(options);
  visualizerFrameDataRef.current.analyser = analyserRef.current;
};
