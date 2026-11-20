import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { AudioOutputSelector } from "#src/shared/components/audio-output/AudioOutputSelector";
import { SonificationAudioPanel } from "#src/shared/components/audio-output/SonificationAudioPanel";
import { VolumeMuteRail } from "#src/shared/components/audio-output/VolumeMuteRail";
import type { ChannelOscillatorConfig } from "../config";
import { useChannelOscillatorAudioStore } from "../store";

const ChannelOscillatorAudioOutputSelector = () => {
  const sinkId = useChannelOscillatorAudioStore((state) => state.sinkId);
  const setSinkId = useChannelOscillatorAudioStore((state) => state.setSinkId);

  return <AudioOutputSelector value={sinkId} onValueChange={setSinkId} mode="icon-popover" />;
};

const ChannelOscillatorVolumeMuteRail = () => {
  const volume = useChannelOscillatorAudioStore((state) => state.volume);
  const muted = useChannelOscillatorAudioStore((state) => state.muted);
  const setVolume = useChannelOscillatorAudioStore((state) => state.setVolume);
  const setMuted = useChannelOscillatorAudioStore((state) => state.setMuted);

  return (
    <VolumeMuteRail
      volume={volume}
      muted={muted}
      onVolumeChange={setVolume}
      onMutedChange={setMuted}
    />
  );
};

export const ChannelOscillatorSonificationPanel = (
  _props: PluginSettingsPanelProps<ChannelOscillatorConfig>,
) => {
  const muted = useChannelOscillatorAudioStore((state) => state.muted);

  return (
    <SonificationAudioPanel muted={muted}>
      <ChannelOscillatorAudioOutputSelector />
      <ChannelOscillatorVolumeMuteRail />
    </SonificationAudioPanel>
  );
};
