import { defineMessages } from "#src/core/i18n";
import { Label } from "#src/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import { createTranslation } from "#src/shared/i18n";
import utilities from "#src/shared/styles/utilities.module.css";
import { type RestBehavior, restBehaviors } from "./motion";

const messages = defineMessages({
  en: {
    "rest.label": "When the hand stops",
    "rest.once": "Play the spot once",
    "rest.repeat": "Repeat the spot about once a second",
    "rest.silent": "Silence",
  },
  it: {
    "rest.label": "Quando la mano si ferma",
    "rest.once": "Suona il punto una volta",
    "rest.repeat": "Ripeti il punto circa una volta al secondo",
    "rest.silent": "Silenzio",
  },
});

const { useT } = createTranslation("sonification/shared", messages);

/** Setting for what a motion-driven sonifier plays when the hand rests in one spot. */
export const RestBehaviorSelect = ({
  value,
  onValueChange,
}: {
  value: RestBehavior;
  onValueChange: (value: RestBehavior) => void;
}) => {
  const t = useT();
  return (
    <div className={utilities.stack2}>
      <Label>{t("rest.label")}</Label>
      <Select value={value} onValueChange={(next) => onValueChange(next as RestBehavior)}>
        <SelectTrigger aria-label={t("rest.label")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {restBehaviors.map((behavior) => (
            <SelectItem key={behavior} value={behavior}>
              {t(`rest.${behavior}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
