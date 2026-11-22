// Small inline SVG icon set (no icon library needed).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const BridgeLogo = (p: P) => (
  <svg viewBox="0 0 48 32" width={40} height={28} {...base} {...p}>
    <path d="M2 24h44" stroke="#FF9933" strokeWidth={3} />
    <path d="M9 24V8M39 24V8" stroke="#FF9933" strokeWidth={3} />
    <path d="M9 8c7 10 23 10 30 0" stroke="#FF9933" strokeWidth={2.5} />
    <path d="M17 24v-7M24 24v-5M31 24v-7" stroke="#F5F7FB" strokeWidth={2} />
  </svg>
);
export const UploadIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={24} height={24} {...base} {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
);
export const SearchIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={24} height={24} {...base} {...p}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
export const PlanIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={24} height={24} {...base} {...p}>
    <path d="M4 19V5M4 19h16" /><path d="m7 14 4-4 3 3 5-6" />
  </svg>
);
export const FileIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={24} height={24} {...base} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={24} height={24} {...base} {...p}><path d="m5 12 5 5 9-10" /></svg>
);
export const WarnIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={24} height={24} {...base} {...p}>
    <path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5v.01" />
  </svg>
);
export const XIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={24} height={24} {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const ExternalIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={20} height={20} {...base} {...p}>
    <path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const ArrowDown = (p: P) => (
  <svg viewBox="0 0 24 24" width={28} height={28} {...base} {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
);
export const ShieldIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" />
  </svg>
);
export const TrashIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);
export const ChevronDown = (p: P) => (
  <svg viewBox="0 0 24 24" width={24} height={24} {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>
);
