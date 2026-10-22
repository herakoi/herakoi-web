import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { AudioOutputSelector } from "#src/shared/components/audio-output/AudioOutputSelector";
import { SonificationAudioPanel } from "#src/shared/components/audio-output/SonificationAudioPanel";
import { VolumeMuteRail } from "#src/shared/components/audio-output/VolumeMuteRail";
import type { OscillatorConfig } from "../config";
import { useOscillatorAudioStore } from "../store";

const OscillatorAudioOutputSelector = () => {
  const sinkId = useOscillatorAudioStore((state) => state.sinkId);
  const setSinkId = useOscillatorAudioStore((state) => state.setSinkId);

  return <AudioOutputSelector value={sinkId} onValueChange={setSinkId} mode="icon-popover" />;
};

const OscillatorVolumeMuteRail = () => {
  const volume = useOscillatorAudioStore((state) => state.volume);
  const muted = useOscillatorAudioStore((state) => state.muted);
  const setVolume = useOscillatorAudioStore((state) => state.setVolume);
  const setMuted = useOscillatorAudioStore((state) => state.setMuted);

  return (
    <VolumeMuteRail
      volume={volume}
      muted={muted}
      onVolumeChange={setVolume}
      onMutedChange={setMuted}
    />
  );
};

export const OscillatorSonificationPanel = (_props: PluginSettingsPanelProps<OscillatorConfig>) => {
  const muted = useOscillatorAudioStore((state) => state.muted);

  return (
    <SonificationAudioPanel muted={muted}>
      <OscillatorAudioOutputSelector />
      <OscillatorVolumeMuteRail />
    </SonificationAudioPanel>
  );
};
