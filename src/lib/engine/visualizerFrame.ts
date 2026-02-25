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
