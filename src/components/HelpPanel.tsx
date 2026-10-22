import { useShellT } from "#src/i18n/shell";

export const HelpPanelContent = () => {
  const t = useShellT();
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("help.howItWorks")}
        </h3>
        <p className="text-sm text-foreground">{t("help.camera")}</p>
        <p className="text-sm text-muted-foreground">{t("help.mapping")}</p>
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("help.aboutUs")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("help.aboutPaper")}{" "}
          <a
            className="text-primary underline underline-offset-2"
            href="https://arxiv.org/abs/2412.09152"
            target="_blank"
            rel="noreferrer"
          >
            arXiv:2412.09152
          </a>{" "}
          {t("help.aboutCode")}{" "}
          <a
            className="text-primary underline underline-offset-2"
            href="https://github.com/herakoi/herakoi-web"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          {t("help.aboutContribute")}
        </p>
      </div>
    </div>
  );
};
