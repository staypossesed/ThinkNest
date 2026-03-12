/** Inline SVG — рендерится напрямую в DOM, работает везде (Electron, web) */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={className}
      width={36}
      height={36}
      style={{ display: "block", flexShrink: 0, minWidth: 36, minHeight: 36 }}
      aria-hidden
    >
      <circle cx="32" cy="36" r="20" fill="#e879f9" />
      <circle cx="32" cy="36" r="14" fill="#f5d0fe" />
      <circle cx="26" cy="32" r="3" fill="#0c0e12" />
      <circle cx="38" cy="32" r="3" fill="#0c0e12" />
      <path d="M28 42 Q32 46 36 42" stroke="#0c0e12" strokeWidth="2" fill="none" />
      <ellipse cx="32" cy="20" rx="8" ry="6" fill="#e879f9" />
    </svg>
  );
}
