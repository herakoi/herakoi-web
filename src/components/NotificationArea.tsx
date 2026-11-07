import type { ReactNode } from "react";
import styles from "./NotificationArea.module.css";

/**
 * Positioned container for plugin notification pills.
 * Always renders children — each plugin decides when to show its own notifications.
 */
export const NotificationArea = ({ children }: { children?: ReactNode }) => {
  return <div className={styles.area}>{children}</div>;
};
