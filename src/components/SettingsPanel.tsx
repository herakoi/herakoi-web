import { clsx } from "clsx";
import { CircleHelp, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useShellT } from "#src/i18n/shell";
import { Button } from "#src/shared/components/ui/button";
import { CardContent } from "#src/shared/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "#src/shared/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#src/shared/components/ui/tabs";
import { HelpPanelContent } from "./HelpPanel";
import styles from "./SettingsPanel.module.css";

export type SettingsPanelSection<K extends string = string> = {
  key: K;
  label: string;
  title?: string;
  icon?: React.ReactNode;
  render: () => React.ReactNode;
};

type SettingsPanelProps<K extends string> = {
  className?: string;
  style?: React.CSSProperties;
  sections: SettingsPanelSection<K>[];
};

export const SettingsPanel = <K extends string>({
  className,
  style,
  sections,
}: SettingsPanelProps<K>) => {
  const t = useShellT();
  const defaultKey = useMemo(() => {
    return sections[0]?.key ?? null;
  }, [sections]);

  const [openSection, setOpenSection] = useState<K | null>(null);
  const open = Boolean(openSection);
  const value = openSection ?? defaultKey;
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className={clsx(styles.root, className)} style={style}>
      <div className={styles.row}>
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            if (!defaultKey) return;
            setOpenSection(nextOpen ? (value ?? defaultKey) : null);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={clsx(styles.roundButton, styles.settingsButton, open && styles.open)}
              aria-label={t("settings.toggle")}
            >
              <SlidersHorizontal className={styles.icon} />
              <span className={styles.buttonLabel}>{t("settings.button")}</span>
            </Button>
          </PopoverTrigger>
          {defaultKey && value ? (
            <PopoverContent align="end" side="top" sideOffset={8} className={styles.panel}>
              <CardContent className={styles.panelContent}>
                <Tabs
                  value={value}
                  onValueChange={(nextValue) => setOpenSection(nextValue as K)}
                  className={styles.tabs}
                >
                  <TabsList className={styles.tabList}>
                    {sections.map((section) => (
                      <TabsTrigger
                        key={section.key}
                        value={section.key}
                        title={section.label}
                        className={styles.tab}
                      >
                        {section.icon ? (
                          <span className={styles.tabIcon}>{section.icon}</span>
                        ) : null}
                        <span className={styles.tabLabel}>{section.label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {sections.map((section) => (
                    <TabsContent
                      key={section.key}
                      value={section.key}
                      className={styles.tabContent}
                    >
                      {section.render()}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </PopoverContent>
          ) : null}
        </Popover>

        <Popover open={helpOpen} onOpenChange={setHelpOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={clsx(styles.roundButton, styles.helpButton, helpOpen && styles.open)}
              aria-label={t("settings.help")}
            >
              <CircleHelp className={styles.icon} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" sideOffset={8} className={styles.helpPanel}>
            <HelpPanelContent />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
