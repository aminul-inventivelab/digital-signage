import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 12;

/** Opacity from 12 o’clock (brightest); quadratic falloff matches a classic 12-segment throbber. */
function barOpacity(index: number): number {
  const t = (BAR_COUNT - index) / BAR_COUNT;
  return 0.08 + 0.92 * t * t;
}

type NavRadialSpinnerProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
};

/**
 * 12-bar radial loader (iOS-style throbber). Uses `currentColor` for bar fill.
 */
export function NavRadialSpinner({
  size = 18,
  className,
  style,
  "aria-label": ariaLabel = "Loading",
  "aria-hidden": ariaHidden = true,
}: NavRadialSpinnerProps) {
  return (
    <span
      className={cn("inline-flex shrink-0 animate-spin items-center justify-center align-middle text-inherit", className)}
      style={{ width: size, height: size, ...style }}
      aria-hidden={ariaHidden}
      aria-label={ariaHidden ? undefined : ariaLabel}
      role={ariaHidden ? undefined : "status"}
    >
      <svg width="100%" height="100%" viewBox="0 0 24 24" className="block">
        <g transform="translate(12 12)">
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <g key={i} transform={`rotate(${i * (360 / BAR_COUNT)})`}>
              <rect
                x={-1.35}
                y={-9.75}
                width={2.7}
                height={6.5}
                rx={1.35}
                ry={1.35}
                fill="currentColor"
                opacity={barOpacity(i)}
              />
            </g>
          ))}
        </g>
      </svg>
    </span>
  );
}
