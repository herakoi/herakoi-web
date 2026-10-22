import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { AudioOutputSelector } from "#src/shared/components/audio-output/AudioOutputSelector";
import { SonificationAudioPanel } from "#src/shared/components/audio-output/SonificationAudioPanel";
import { VolumeMuteRail } from "#src/shared/components/audio-output/VolumeMuteRail";
import type { PianoSamplerConfig } from "../config";
import { usePianoSamplerAudioStore } from "../store";

const PianoAudioOutputSelector = () => {
  const sinkId = usePianoSamplerAudioStore((state) => state.sinkId);
  const setSinkId = usePianoSamplerAudioStore((state) => state.setSinkId);

  return <AudioOutputSelector value={sinkId} onValueChange={setSinkId} mode="icon-popover" />;
};

const PianoVolumeMuteRail = () => {
  const volume = usePianoSamplerAudioStore((state) => state.volume);
  const muted = usePianoSamplerAudioStore((state) => state.muted);
  const setVolume = usePianoSamplerAudioStore((state) => state.setVolume);
  const setMuted = usePianoSamplerAudioStore((state) => state.setMuted);

  return (
    <VolumeMuteRail
      volume={volume}
      muted={muted}
      onVolumeChange={setVolume}
      onMutedChange={setMuted}
    />
  );
};

export const PianoSamplerSonificationPanel = (
  _props: PluginSettingsPanelProps<PianoSamplerConfig>,
) => {
  const muted = usePianoSamplerAudioStore((state) => state.muted);

  return (
    <SonificationAudioPanel muted={muted}>
      <PianoAudioOutputSelector />
      <PianoVolumeMuteRail />
    </SonificationAudioPanel>
  );
};
