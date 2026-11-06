import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useShellT } from "#src/i18n/shell";
import { appVersion, checkForUpdate, type UpdateCheckResult } from "#src/lib/pwa";
import { Button } from "#src/shared/components/ui/button";

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
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {t("update.version", { version: appVersion.version, commit: appVersion.commit })}
      </p>
      <Button
        variant="outline"
        onClick={handleCheck}
        disabled={status === "checking" || status === "updating"}
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {t("update.check")}
      </Button>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {status ? t(statusKeys[status]) : null}
      </p>
    </div>
  );
};
