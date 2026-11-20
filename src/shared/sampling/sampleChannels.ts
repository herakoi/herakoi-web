/**
 * The channels the active sampler provides, for sonifiers to choose from.
 *
 * Why: a sonifier that maps channels to sound properties needs the list of channels
 * (with names and ranges) in its settings and to normalise values, while plugins
 * must not depend on each other.
 * What: the active sampler publishes its channels here when they change (e.g. a new
 * image with other layers) and clears them on dispose; readers fall back to the
 * hue/saturation/value channels every sampler provides.
 */

import { create } from "zustand";
import { hsvSampleChannels, type SampleChannel } from "#src/core/interfaces";

type SampleChannelsState = {
  channels: readonly SampleChannel[] | null;
};

const useSampleChannelsStore = create<SampleChannelsState>(() => ({ channels: null }));

export const publishSampleChannels = (channels: readonly SampleChannel[]) => {
  useSampleChannelsStore.setState({ channels });
};

export const clearSampleChannels = () => {
  useSampleChannelsStore.setState({ channels: null });
};

export const getSampleChannels = (): readonly SampleChannel[] =>
  useSampleChannelsStore.getState().channels ?? hsvSampleChannels;

/** Call `listener` with the current channels whenever they change. */
export const subscribeSampleChannels = (listener: (channels: readonly SampleChannel[]) => void) =>
  useSampleChannelsStore.subscribe((state) => listener(state.channels ?? hsvSampleChannels));

export const useSampleChannels = (): readonly SampleChannel[] =>
  useSampleChannelsStore((state) => state.channels) ?? hsvSampleChannels;
