import type { CSSProperties, RefObject } from "react";
import { useShellT } from "#src/i18n/shell";
import { ReactiveMark } from "../ReactiveMark";
import styles from "./BrandMark.module.css";

type BrandMarkProps = {
  analyserRef: RefObject<AnalyserNode | null>;
  dimLogoMark: boolean;
  uiFadeStyle: CSSProperties;
  logoRef: RefObject<HTMLButtonElement | null>;
};

export const BrandMark = ({ analyserRef, dimLogoMark, uiFadeStyle, logoRef }: BrandMarkProps) => {
  const t = useShellT();
  const handleClick = () => {
    if (typeof window === "undefined") return;
    window.location.reload();
  };

  return (
    <button
      ref={logoRef}
      type="button"
      className={styles.brand}
      onClick={handleClick}
      aria-label={t("header.reload")}
    >
      <div className={styles.markWrapper} style={dimLogoMark ? uiFadeStyle : undefined}>
        <ReactiveMark analyserRef={analyserRef} size={56} tone="light" className={styles.mark} />
      </div>
      <span className={styles.wordmark} style={uiFadeStyle}>
        herakoi
      </span>
    </button>
  );
};
