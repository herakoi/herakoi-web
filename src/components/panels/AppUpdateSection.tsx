import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useShellT } from "#src/i18n/shell";
import { appVersion, checkForUpdate, type UpdateCheckResult } from "#src/lib/pwa";
import { Button } from "#src/shared/components/ui/button";
import styles from "./AppUpdateSection.module.css";

type Status = UpdateCheckResult | "checking" | null;

const statusKeys = {
  checking: "update.checking",
  updating: "update.updating",
  upToDate: "update.upToDate",
  unavailable: "update.unavailable",
  failed: "update.failed",
} as const;

/** Running version plus a button that checks the server for a newer one. */
export const AppUpdateSection = () => {
  const t = useShellT();
  const [status, setStatus] = useState<Status>(null);

  const handleCheck = async () => {
    setStatus("checking");
    setStatus(await checkForUpdate());
  };

  return (
    <div className={styles.section}>
      <p className={styles.version}>
        {t("update.version", { version: appVersion.version, commit: appVersion.commit })}
      </p>
      <Button
        variant="outline"
        onClick={handleCheck}
        disabled={status === "checking" || status === "updating"}
        className={styles.button}
      >
        <RefreshCw className={styles.icon} aria-hidden="true" />
        {t("update.check")}
      </Button>
      <p className={styles.status} aria-live="polite">
        {status ? t(statusKeys[status]) : null}
      </p>
    </div>
  );
};
