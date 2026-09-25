// src/ui/icons.tsx
//
// Chunky inline SVG icons with rounded strokes. They inherit currentColor.

import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export const PlayIcon = () => (
  <Icon>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </Icon>
);

export const PauseIcon = () => (
  <Icon>
    <rect x="6.5" y="5.5" width="3.5" height="13" rx="1.2" fill="currentColor" />
    <rect x="14" y="5.5" width="3.5" height="13" rx="1.2" fill="currentColor" />
  </Icon>
);

/** Two arrows; the solid one shows the current direction. */
export const DirectionIcon = ({ direction }: { direction: 1 | -1 }) => (
  <Icon style={{ transform: direction === -1 ? "scaleX(-1)" : undefined }}>
    <path d="M4 9h13" />
    <path d="M13.5 5l4 4-4 4" />
    <path d="M20 15.5H8" opacity="0.35" />
    <path d="M10.5 12l-3.5 3.5 3.5 3.5" opacity="0.35" />
  </Icon>
);

export const ResetIcon = () => (
  <Icon>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.5v4h4" />
  </Icon>
);

export const CameraIcon = () => (
  <Icon width="18" height="18">
    <path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z" />
    <circle cx="12" cy="13.2" r="3" />
  </Icon>
);

export const OverviewIcon = () => (
  <Icon width="18" height="18">
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
    <circle cx="12" cy="12" r="2.6" />
  </Icon>
);

export const ChevronIcon = ({ up }: { up: boolean }) => (
  <Icon width="18" height="18" style={{ transform: up ? "rotate(180deg)" : undefined, transition: "transform 200ms" }}>
    <path d="M6 9.5l6 6 6-6" />
  </Icon>
);

/** The 4sight mark: a clock face whose hand sweeps through four ticks. */
export const Mark = () => (
  <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
    <circle cx="16" cy="16" r="13" fill="var(--terracotta)" stroke="var(--ink)" strokeWidth="2.6" />
    <circle cx="16" cy="16" r="7.5" fill="var(--mustard)" stroke="var(--ink)" strokeWidth="2.2" />
    <path d="M16 16V10.5M16 16l3.8 2.2" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
    {[0, 90, 180, 270].map((a) => (
      <circle
        key={a}
        cx={16 + 10.2 * Math.sin((a * Math.PI) / 180)}
        cy={16 - 10.2 * Math.cos((a * Math.PI) / 180)}
        r="1.3"
        fill="var(--cream)"
      />
    ))}
  </svg>
);
