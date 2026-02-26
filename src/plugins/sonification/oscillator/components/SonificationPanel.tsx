import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { AudioOutputSelector } from "#src/shared/components/audio-output/AudioOutputSelector";
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
  return (
    <aside
      className="pointer-events-auto fixed right-2 top-1/2 z-10 flex h-[248px] w-12 -translate-y-1/2 flex-col items-center gap-3 rounded-full border border-border/60 bg-black/55 py-3 text-card-foreground shadow-card backdrop-blur sm:right-4"
      aria-label="Sonification audio controls"
    >
      <OscillatorAudioOutputSelector />
      <OscillatorVolumeMuteRail />
    </aside>
  );
};
