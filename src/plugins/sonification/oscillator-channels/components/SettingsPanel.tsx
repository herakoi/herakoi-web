import { Plus, Trash2 } from "lucide-react";
import { useId, useMemo } from "react";
import type { SampleChannel } from "#src/core/interfaces";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { type SoundMode, soundModes } from "#src/plugins/sonification/shared/motionGate";
import { RestBehaviorSelect } from "#src/plugins/sonification/shared/RestBehaviorSelect";
import { voiceEffectKinds } from "#src/plugins/sonification/shared/voiceEffects";
import { AudioOutputSelector } from "#src/shared/components/audio-output/AudioOutputSelector";
import { Button } from "#src/shared/components/ui/button";
import { Label } from "#src/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import { Slider } from "#src/shared/components/ui/slider";
import { Switch } from "#src/shared/components/ui/switch";
import { useSampleChannels } from "#src/shared/sampling/sampleChannels";
import utilities from "#src/shared/styles/utilities.module.css";
import { handSpeedChannel, type NoDataBehavior } from "../ChannelOscillatorSonifier";
import {
  type ChannelOscillatorConfig,
  type EffectSlotConfig,
  type EffectSlotKind,
  effectSlotsOf,
} from "../config";
import { useT } from "../i18n";
import { useChannelOscillatorAudioStore } from "../store";
import styles from "./SettingsPanel.module.css";

/** Value of the "None" option; Radix Select does not accept an empty value. */
const NONE = "__none__";

const translatedChannels = new Set(["hueByte", "saturationByte", "valueByte", "handSpeed"]);

const noDataBehaviors: NoDataBehavior[] = ["pulse", "proximity", "silence", "neutral"];

type ChannelPickerProps = {
  label: string;
  value: string | null;
  channels: readonly SampleChannel[];
  allowNone?: boolean;
  invert: boolean;
  invertLabel: string;
  noData: NoDataBehavior;
  /** "neutral" means the mid-range value for pitch/volume, the neutral setting for effects. */
  neutralKind: "mid" | "effect";
  noDataLabel: string;
  onChannelChange: (channel: string | null) => void;
  onInvertChange: (invert: boolean) => void;
  onNoDataChange: (noData: NoDataBehavior) => void;
};

const ChannelPicker = ({
  label,
  value,
  channels,
  allowNone = false,
  invert,
  invertLabel,
  noData,
  neutralKind,
  noDataLabel,
  onChannelChange,
  onInvertChange,
  onNoDataChange,
}: ChannelPickerProps) => {
  const t = useT();
  const invertId = useId();
  const channelName = (channel: SampleChannel) =>
    translatedChannels.has(channel.key)
      ? t(`channel.${channel.key as "hueByte" | "saturationByte" | "valueByte" | "handSpeed"}`)
      : channel.label;
  // A stored channel the current image lacks stays selectable, so the choice is not lost.
  const missing = value !== null && !channels.some((channel) => channel.key === value);

  return (
    <>
      <div className={styles.channelRow}>
        <Select
          value={value ?? NONE}
          onValueChange={(next) => onChannelChange(next === NONE ? null : next)}
        >
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowNone ? <SelectItem value={NONE}>{t("channel.none")}</SelectItem> : null}
            {channels.map((channel) => (
              <SelectItem key={channel.key} value={channel.key}>
                {channelName(channel)}
              </SelectItem>
            ))}
            {missing ? (
              <SelectItem value={value}>{t("channel.unavailable", { key: value })}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        <div className={styles.invert}>
          <Switch
            id={invertId}
            checked={invert}
            aria-label={invertLabel}
            onCheckedChange={onInvertChange}
          />
          <Label htmlFor={invertId} className={styles.invertLabel}>
            {t("invert")}
          </Label>
        </div>
      </div>
      {value !== null ? (
        <div className={styles.noDataRow}>
          <span className={styles.noDataLabel}>{t("noData.label")}</span>
          <Select value={noData} onValueChange={(next) => onNoDataChange(next as NoDataBehavior)}>
            <SelectTrigger aria-label={noDataLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {noDataBehaviors.map((behavior) => (
                <SelectItem key={behavior} value={behavior}>
                  {behavior === "neutral"
                    ? t(neutralKind === "mid" ? "noData.neutral.mid" : "noData.neutral.effect")
                    : t(`noData.${behavior}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </>
  );
};

const effectKinds = voiceEffectKinds.filter((kind): kind is EffectSlotKind => kind !== "none");

type EffectSlotEditorProps = {
  slot: EffectSlotConfig;
  index: number;
  channels: readonly SampleChannel[];
  /** Kinds taken by other slots: each effect type is used at most once. */
  usedKinds: readonly EffectSlotKind[];
  onChange: (updates: Partial<EffectSlotConfig>) => void;
  onRemove: () => void;
};

const EffectSlotEditor = ({
  slot,
  index,
  channels,
  usedKinds,
  onChange,
  onRemove,
}: EffectSlotEditorProps) => {
  const t = useT();
  const name = t("effects.name", { number: index + 1 });

  return (
    <div className={styles.effectSlot}>
      <div className={styles.effectHeader}>
        <Select
          value={slot.kind}
          onValueChange={(kind) => onChange({ kind: kind as EffectSlotKind })}
        >
          <SelectTrigger aria-label={t("effects.kind", { name })}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {effectKinds
              .filter((kind) => kind === slot.kind || !usedKinds.includes(kind))
              .map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t(`effect.${kind}`)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("effects.remove", { name })}
          onClick={onRemove}
        >
          <Trash2 className={styles.buttonIcon} aria-hidden="true" />
        </Button>
      </div>
      <p className={styles.hint}>{t(`effect.${slot.kind}.hint`)}</p>
      <ChannelPicker
        label={t("effects.channel", { name })}
        value={slot.channel}
        channels={channels}
        invert={slot.invert}
        invertLabel={t("invert.aria", { property: name })}
        onChannelChange={(channel) => {
          if (channel) onChange({ channel });
        }}
        onInvertChange={(invert) => onChange({ invert })}
        noData={slot.noData}
        neutralKind="effect"
        noDataLabel={t("noData.aria", { property: name })}
        onNoDataChange={(noData) => onChange({ noData })}
      />
      <Label>{t("effectAmount.label", { amount: Math.round(slot.amount * 100) })}</Label>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[slot.amount * 100]}
        aria-label={t("effectAmount.aria", { name })}
        onValueChange={([amount]) => onChange({ amount: amount / 100 })}
      />
    </div>
  );
};

export const ChannelOscillatorSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<ChannelOscillatorConfig>) => {
  const t = useT();
  const sampleChannels = useSampleChannels();
  const channels = useMemo(() => [...sampleChannels, handSpeedChannel], [sampleChannels]);
  const sinkId = useChannelOscillatorAudioStore((state) => state.sinkId);
  const setSinkId = useChannelOscillatorAudioStore((state) => state.setSinkId);
  // Hand speed drives pitch or volume only; effects follow image channels.
  const effectChannels = sampleChannels;
  const effects = effectSlotsOf(config);
  const freeKinds = effectKinds.filter((kind) => !effects.some((slot) => slot.kind === kind));
  const usesProximity =
    config.pitchNoData === "proximity" ||
    config.volumeNoData === "proximity" ||
    effects.some((slot) => slot.channel !== null && slot.noData === "proximity");

  const updateEffect = (id: string, updates: Partial<EffectSlotConfig>) => {
    setConfig({
      effects: effects.map((slot) => (slot.id === id ? { ...slot, ...updates } : slot)),
    });
  };

  const addEffect = () => {
    const kind = freeKinds[0];
    if (!kind) return;
    // Start from an image layer when there is one: that is what extra effects are for.
    const channel =
      effectChannels.find((channel) => channel.key.startsWith("layer."))?.key ?? "saturationByte";
    const ids = effects.map((slot) => Number(slot.id.replace("effect-", "")) || 0);
    setConfig({
      effects: [
        ...effects,
        {
          id: `effect-${Math.max(0, ...ids) + 1}`,
          channel,
          invert: false,
          noData: "pulse",
          kind,
          amount: 0.7,
        },
      ],
    });
  };

  return (
    <div className={utilities.stack4}>
      <AudioOutputSelector value={sinkId} onValueChange={setSinkId} mode="inline" />

      <div className={utilities.stack2}>
        <Label>{t("soundMode.label")}</Label>
        <Select
          value={config.soundMode}
          onValueChange={(value) => setConfig({ soundMode: value as SoundMode })}
        >
          <SelectTrigger aria-label={t("soundMode.label")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {soundModes.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {t(`soundMode.${mode}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {config.soundMode !== "continuous" ? (
        <RestBehaviorSelect
          value={config.restBehavior}
          onValueChange={(restBehavior) => setConfig({ restBehavior })}
        />
      ) : null}

      <section className={utilities.stack2}>
        <h3 className={styles.heading}>{t("pitch.title")}</h3>
        <ChannelPicker
          label={t("pitch.channel")}
          value={config.pitchChannel}
          channels={channels}
          invert={config.pitchInvert}
          invertLabel={t("invert.aria", { property: t("pitch.title") })}
          onChannelChange={(channel) => {
            if (channel) setConfig({ pitchChannel: channel });
          }}
          onInvertChange={(pitchInvert) => setConfig({ pitchInvert })}
          noData={config.pitchNoData}
          neutralKind="mid"
          noDataLabel={t("noData.aria", { property: t("pitch.title") })}
          onNoDataChange={(pitchNoData) => setConfig({ pitchNoData })}
        />
        <Label>{t("frequencyRange.label", { min: config.minFreq, max: config.maxFreq })}</Label>
        <Slider
          min={100}
          max={2000}
          step={10}
          value={[config.minFreq, config.maxFreq]}
          aria-label={t("frequencyRange.aria")}
          thumbLabels={[t("frequencyRange.min"), t("frequencyRange.max")]}
          onValueChange={([min, max]) => setConfig({ minFreq: min, maxFreq: max })}
        />
      </section>

      <section className={utilities.stack2}>
        <h3 className={styles.heading}>{t("volume.title")}</h3>
        <ChannelPicker
          label={t("volume.channel")}
          value={config.volumeChannel}
          channels={channels}
          invert={config.volumeInvert}
          invertLabel={t("invert.aria", { property: t("volume.title") })}
          onChannelChange={(channel) => {
            if (channel) setConfig({ volumeChannel: channel });
          }}
          onInvertChange={(volumeInvert) => setConfig({ volumeInvert })}
          noData={config.volumeNoData}
          neutralKind="mid"
          noDataLabel={t("noData.aria", { property: t("volume.title") })}
          onNoDataChange={(volumeNoData) => setConfig({ volumeNoData })}
        />
        <Label>
          {t("volumeRange.label", {
            min: Math.round(config.minVol * 100),
            max: Math.round(config.maxVol * 100),
          })}
        </Label>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[config.minVol * 100, config.maxVol * 100]}
          aria-label={t("volumeRange.aria")}
          thumbLabels={[t("volumeRange.min"), t("volumeRange.max")]}
          onValueChange={([min, max]) => setConfig({ minVol: min / 100, maxVol: max / 100 })}
        />
      </section>

      <section className={utilities.stack2}>
        <h3 className={styles.heading}>{t("effects.title")}</h3>
        {effects.length === 0 ? <p className={styles.hint}>{t("effects.empty")}</p> : null}
        {effects.map((slot, index) => (
          <EffectSlotEditor
            key={slot.id}
            slot={slot}
            index={index}
            channels={effectChannels}
            usedKinds={effects.filter((other) => other.id !== slot.id).map((other) => other.kind)}
            onChange={(updates) => updateEffect(slot.id, updates)}
            onRemove={() => setConfig({ effects: effects.filter((other) => other.id !== slot.id) })}
          />
        ))}
        {freeKinds.length > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={addEffect}>
            <Plus className={styles.buttonIcon} aria-hidden="true" />
            {t("effects.add")}
          </Button>
        ) : null}
      </section>

      {usesProximity ? (
        <section className={utilities.stack2}>
          <Label>{t("proximity.label", { reach: Math.round(config.proximityReach * 100) })}</Label>
          <Slider
            min={2}
            max={50}
            step={1}
            value={[config.proximityReach * 100]}
            aria-label={t("proximity.aria")}
            onValueChange={([reach]) => setConfig({ proximityReach: reach / 100 })}
          />
          <p className={styles.hint}>{t("proximity.hint")}</p>
        </section>
      ) : null}

      <div className={utilities.stack2}>
        <Label>{t("waveform.label")}</Label>
        <Select
          value={config.oscillatorType}
          onValueChange={(value) => setConfig({ oscillatorType: value as OscillatorType })}
        >
          <SelectTrigger aria-label={t("waveform.aria")}>
            <SelectValue placeholder={t("waveform.label")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sine">{t("waveform.sine")}</SelectItem>
            <SelectItem value="triangle">{t("waveform.triangle")}</SelectItem>
            <SelectItem value="sawtooth">{t("waveform.sawtooth")}</SelectItem>
            <SelectItem value="square">{t("waveform.square")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
