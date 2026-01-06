import type { CSSProperties, RefObject } from "react";
import { cn } from "../../lib/utils";
import { ReactiveMark } from "../ReactiveMark";

type BrandMarkProps = {
  analyserRef: RefObject<AnalyserNode | null>;
  logoTone: "light" | "dark";
  dimLogoMark: boolean;
  uiFadeStyle: CSSProperties;
  logoRef: RefObject<HTMLButtonElement>;
};

export const BrandMark = ({
  analyserRef,
  logoTone,
  dimLogoMark,
  uiFadeStyle,
  logoRef,
}: BrandMarkProps) => {
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
          tone={logoTone}
          className="relative z-0 -mr-4 origin-left scale-[1.3] opacity-95"
        />
      </div>
      <span
        className={cn(
          "relative z-10 hidden font-brand text-[28px] font-normal leading-none transition-opacity md:inline",
          logoTone === "dark" ? "text-neutral-900/80" : "text-white/95",
        )}
        style={uiFadeStyle}
      >
        herakoi
      </span>
    </button>
  );
};
