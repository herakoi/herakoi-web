import { SlidersHorizontal } from "lucide-react";
import type {
  PluginRuntimeContext,
  PluginUISlots,
  SonificationPluginDefinition,
  SonifierHandle,
} from "#src/core/plugin";
import { defineSonificationPlugin } from "#src/core/plugin";
import { getSampleChannels, subscribeSampleChannels } from "#src/shared/sampling/sampleChannels";
import {
  ChannelOscillatorSonifier,
  type ChannelOscillatorSonifierOptions,
} from "./ChannelOscillatorSonifier";
import { ChannelOscillatorSettingsPanel } from "./components/SettingsPanel";
import { ChannelOscillatorSonificationPanel } from "./components/SonificationPanel";
import {
  type ChannelOscillatorConfig,
  channelOscillatorPluginId,
  defaultChannelOscillatorConfig,
} from "./config";
import "./i18n";
import { useChannelOscillatorAudioStore } from "./store";

const ui: PluginUISlots<ChannelOscillatorConfig> = {
  SettingsPanel: ChannelOscillatorSettingsPanel,
  SonificationPanel: ChannelOscillatorSonificationPanel,
};

const optionsFromConfig = (config: ChannelOscillatorConfig): ChannelOscillatorSonifierOptions => ({
  pitchBinding: {
    channel: config.pitchChannel,
    invert: config.pitchInvert,
    noData: config.pitchNoData,
  },
  volumeBinding: {
    channel: config.volumeChannel,
    invert: config.volumeInvert,
    noData: config.volumeNoData,
  },
  effectBinding: {
    channel: config.effectChannel,
    invert: config.effectInvert,
    noData: config.effectNoData,
  },
  effectKind: config.effectChannel ? config.effectKind : "none",
  effectAmount: config.effectAmount,
  proximityReach: config.proximityReach,
  minFreq: config.minFreq,
  maxFreq: config.maxFreq,
  minVol: config.minVol,
  maxVol: config.maxVol,
  oscillatorType: config.oscillatorType,
});

export const plugin: SonificationPluginDefinition<
  typeof channelOscillatorPluginId,
  ChannelOscillatorConfig
> = defineSonificationPlugin({
  id: channelOscillatorPluginId,
  displayName: "Channel Oscillator",
  icon: SlidersHorizontal,
  ui,
  config: {
    defaultConfig: defaultChannelOscillatorConfig,
  },

  createSonifier(
    config: ChannelOscillatorConfig,
    runtime: PluginRuntimeContext<ChannelOscillatorConfig>,
  ): SonifierHandle {
    const audioState = useChannelOscillatorAudioStore.getState();
    const sonifier = new ChannelOscillatorSonifier(undefined, {
      ...optionsFromConfig(config),
      channels: getSampleChannels(),
      masterVolume: audioState.volume,
      muted: audioState.muted,
      sinkId: audioState.sinkId,
    });

    const unsubscribe = runtime.subscribeConfig((nextConfig) => {
      sonifier.configure(optionsFromConfig(nextConfig));
    });
    const unsubscribeChannels = subscribeSampleChannels((channels) => {
      sonifier.configure({ channels });
    });
    const unsubscribeAudio = useChannelOscillatorAudioStore.subscribe((nextState, prevState) => {
      if (nextState.volume !== prevState.volume || nextState.muted !== prevState.muted) {
        sonifier.configure({
          masterVolume: nextState.volume,
          muted: nextState.muted,
        });
      }

      if (nextState.sinkId !== prevState.sinkId) {
        void sonifier.setOutputSinkId(nextState.sinkId);
      }
    });

    const dispose = () => {
      unsubscribe();
      unsubscribeChannels();
      unsubscribeAudio();
      sonifier.stop();
    };

    return {
      sonifier,
      extras: {
        getAnalyser: (options?: { fftSize?: number; smoothingTimeConstant?: number }) =>
          sonifier.getAnalyserNode(options),
        getLastFrameDebug: () => sonifier.getLastFrameDebug(),
      },
      cleanup: () => dispose(),
      [Symbol.dispose]: dispose,
    };
  },
});
