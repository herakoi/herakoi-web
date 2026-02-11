import { create } from "zustand";
import type { NotificationData } from "#src/core/plugin";

type NotificationState = {
  notifications: Map<string, NotificationData>;
  show: (id: string, data: NotificationData) => void;
  hide: (id: string) => void;
  clearAll: () => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: new Map(),
  show: (id, data) =>
    set((state) => {
      const next = new Map(state.notifications);
      next.set(id, data);
      return { notifications: next };
    }),
  hide: (id) =>
    set((state) => {
      const next = new Map(state.notifications);
      next.delete(id);
      return { notifications: next };
    }),
  clearAll: () => set({ notifications: new Map() }),
}));
