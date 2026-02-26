export const pointerDetectionPluginId = "detection/pointer" as const;

export type PointerDetectionConfig = Record<string, never>;

export const defaultPointerDetectionConfig: PointerDetectionConfig = {};
