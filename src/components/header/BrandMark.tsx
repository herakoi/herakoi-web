import type { CSSProperties, RefObject } from "react";
import { ReactiveMark } from "../ReactiveMark";

type BrandMarkProps = {
  analyserRef: RefObject<AnalyserNode | null>;
  dimLogoMark: boolean;
  uiFadeStyle: CSSProperties;
  logoRef: RefObject<HTMLButtonElement>;
};

export const BrandMark = ({ analyserRef, dimLogoMark, uiFadeStyle, logoRef }: BrandMarkProps) => {
  const handleClick = () => {
    if (typeof window === "undefined") return;
    window.location.reload();
  };

  return (
    <button
      ref={logoRef}
      type="button"
      className="pointer-events-auto flex min-w-0 items-center gap-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0"
      onClick={handleClick}
      aria-label="Reload page"
    >
      <div className="transition-opacity" style={dimLogoMark ? uiFadeStyle : undefined}>
        <ReactiveMark
          analyserRef={analyserRef}
          size={56}
          tone="light"
          className="relative z-0 -mr-4 origin-left scale-[1.3] opacity-95"
        />
      </div>
      <span
        className="relative z-10 hidden font-brand text-[28px] font-normal leading-none text-white/95 transition-opacity md:inline"
        style={uiFadeStyle}
      >
        herakoi
      </span>
    </button>
  );
};
