import { useState, useRef, useEffect } from "react";
import { t } from "../i18n";

export type UiLocale = "ru" | "en" | "zh";

const LOCALES: { code: UiLocale; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
  { code: "zh", flag: "🇨🇳", label: "中文" }
];

interface LanguageSelectorProps {
  value: UiLocale;
  onChange: (locale: UiLocale) => void;
}

export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === value) ?? LOCALES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="language-selector" ref={ref}>
      <button
        type="button"
        className="language-selector-trigger"
        onClick={() => setOpen(!open)}
        title={`${t(value, "language")}: ${current.label}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="language-selector-label">{t(value, "language")}</span>
        <span className="language-selector-flag">{current.flag}</span>
      </button>
      {open && (
        <div className="language-selector-dropdown" role="listbox">
          {LOCALES.map((loc) => (
            <button
              key={loc.code}
              type="button"
              role="option"
              aria-selected={value === loc.code}
              className={`language-selector-option ${value === loc.code ? "language-selector-option--active" : ""}`}
              onClick={() => {
                onChange(loc.code);
                setOpen(false);
              }}
            >
              <span className="language-selector-flag">{loc.flag}</span>
              <span>{loc.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
