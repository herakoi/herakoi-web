import { useCallback } from "react";
import type { ActivePlugins } from "../../state/appConfigStore";
import { useActivePlugin } from "../../state/appConfigStore";

type SwitchableSlot = "detection" | "sampling" | "sonification";

type UsePluginSwitchParams = {
  stopTransport: () => void;
};

/**
 * Switch the active plugin of a slot: stop transport, then switch plugin.
 * Stopping first flushes active tones before the old handles are disposed. The shell's
 * auto-start resumes playback once the new handles are ready, unless the user paused.
 */
export const usePluginSwitch = <K extends SwitchableSlot>(
  slot: K,
  { stopTransport }: UsePluginSwitchParams,
) => {
  const [, setActiveId] = useActivePlugin(slot);

  return useCallback(
    (id: string) => {
      stopTransport();
      setActiveId(id as ActivePlugins[K]);
    },
    [stopTransport, setActiveId],
  );
};
