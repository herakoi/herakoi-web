import { localeNames, supportedLocales } from "#src/core/i18n";
import type { VisualizationPlugin } from "#src/core/plugin";
import { useShellT } from "#src/i18n/shell";
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
import { isLocale, useLocale, usePluginName } from "#src/shared/i18n";
import { useActivePlugin, useAppConfigStore, useUiPreferences } from "../../state/appConfigStore";
import { AppUpdateSection } from "./AppUpdateSection";
import styles from "./VisualizerPanel.module.css";

type VisualizerPanelProps = {
  visualizers: readonly VisualizationPlugin[];
};

export const VisualizerPanel = ({ visualizers }: VisualizerPanelProps) => {
  const t = useShellT();
  const pluginName = usePluginName();
  const locale = useLocale();
  const [activeVisualizerId, setActiveVisualizerId] = useActivePlugin("visualization");
  const [uiPrefs, setUiPrefs] = useUiPreferences();
  const resetAll = useAppConfigStore((s) => s.resetAll);

  const handleResetDefaults = () => {
    // Reset EVERYTHING: activePlugins, pluginConfigs, uiPreferences
    resetAll();
  };

  const opacityPercent = Math.round(uiPrefs.baseUiOpacity * 100);

  return (
    <div className={styles.panel}>
      {/* Visualizer selector */}
      <div className={styles.field}>
        <Label>{t("preferences.visualizer")}</Label>
        <Select
          value={activeVisualizerId ?? "none"}
          onValueChange={(value) => {
            setActiveVisualizerId(value === "none" ? null : value);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("preferences.visualizerPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("preferences.visualizerNone")}</SelectItem>
            {visualizers.map((plugin) => (
              <SelectItem key={plugin.id} value={plugin.id}>
                {pluginName(plugin)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Render settings panel for active visualizer if it has one */}
      {activeVisualizerId &&
        (() => {
          const activePlugin = visualizers.find((p) => p.id === activeVisualizerId);
          const SettingsPanel = activePlugin?.ui.SettingsPanel;
          return SettingsPanel ? <SettingsPanel /> : null;
        })()}

      {/* Preferences (moved from separate tab) */}
      <div className={styles.preferences}>
        <h3 className={styles.title}>{t("preferences.title")}</h3>
        <div className={styles.field}>
          <Label htmlFor="language-select">{t("preferences.language")}</Label>
          <Select
            value={locale}
            onValueChange={(value) => {
              if (isLocale(value)) setUiPrefs({ language: value });
            }}
          >
            <SelectTrigger id="language-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedLocales.map((code) => (
                <SelectItem key={code} value={code} lang={code}>
                  {localeNames[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handleResetDefaults}>
          {t("preferences.restoreDefaults")}
        </Button>
        <div className={styles.field}>
          <Label>{t("preferences.opacity", { percent: opacityPercent })}</Label>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[opacityPercent]}
            aria-label={t("preferences.opacityLevel")}
            onValueChange={([value]) => setUiPrefs({ baseUiOpacity: value / 100 })}
          />
        </div>
        <div className={styles.toggleRow}>
          <Label className={styles.toggleLabel} htmlFor="dim-logo-mark">
            {t("preferences.dimLogo")}
          </Label>
          <Switch
            id="dim-logo-mark"
            checked={uiPrefs.dimLogoMark}
            onCheckedChange={(checked) => setUiPrefs({ dimLogoMark: checked })}
          />
        </div>
        <AppUpdateSection />
      </div>
    </div>
  );
};
