import { X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { ScreenReaderAnnouncer } from "#src/components/ScreenReaderAnnouncer";
import { useCommonT } from "#src/shared/i18n/common";
import styles from "./PluginNotification.module.css";

export type PluginNotificationProps = {
  message: string;
  icon?: ComponentType<{ className?: string }>;
  screenReaderMessage?: string;
  politeness?: "polite" | "assertive";
  /** Called when the user dismisses the notification. If omitted, no dismiss button is shown. */
  onDismiss?: () => void;
  /** Custom pill content instead of icon+message */
  children?: ReactNode;
};

export const PluginNotification = ({
  message,
  icon: Icon,
  screenReaderMessage,
  politeness,
  onDismiss,
  children,
}: PluginNotificationProps) => {
  const t = useCommonT();
  return (
    <>
      <div className={styles.pill}>
        {children ?? (
          <>
            {Icon && <Icon className={styles.icon} />}
            <span className={styles.message}>{message}</span>
          </>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("notification.dismiss")}
            className={styles.dismiss}
          >
            <X className={styles.dismissIcon} />
          </button>
        )}
      </div>
      <ScreenReaderAnnouncer message={screenReaderMessage ?? message} politeness={politeness} />
    </>
  );
};
