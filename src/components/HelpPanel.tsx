import { clsx } from "clsx";
import { useShellT } from "#src/i18n/shell";
import styles from "./HelpPanel.module.css";

export const HelpPanelContent = () => {
  const t = useShellT();
  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <h3 className={styles.heading}>{t("help.howItWorks")}</h3>
        <p className={clsx(styles.text, styles.lead)}>{t("help.camera")}</p>
        <p className={styles.text}>{t("help.mapping")}</p>
      </div>
      <div className={styles.section}>
        <h3 className={styles.heading}>{t("help.aboutUs")}</h3>
        <p className={styles.text}>
          {t("help.aboutPaper")}{" "}
          <a
            className={styles.link}
            href="https://arxiv.org/abs/2412.09152"
            target="_blank"
            rel="noreferrer"
          >
            arXiv:2412.09152
          </a>{" "}
          {t("help.aboutCode")}{" "}
          <a
            className={styles.link}
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
