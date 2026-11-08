import utilities from "#src/shared/styles/utilities.module.css";

type Props = {
  message: string;
  politeness?: "polite" | "assertive";
};

export const ScreenReaderAnnouncer = ({ message, politeness = "polite" }: Props) => (
  <div className={utilities.srOnly} aria-live={politeness} aria-atomic="true">
    {message}
  </div>
);
