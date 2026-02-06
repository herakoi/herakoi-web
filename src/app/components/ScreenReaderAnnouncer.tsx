type Props = {
  message: string;
  politeness?: "polite" | "assertive";
};

export const ScreenReaderAnnouncer = ({ message, politeness = "polite" }: Props) => (
  <div className="sr-only" aria-live={politeness} aria-atomic="true">
    {message}
  </div>
);
