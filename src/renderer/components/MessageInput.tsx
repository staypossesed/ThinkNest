import { useRef } from "react";
import type { UiLocale } from "./LanguageSelector";
import { t } from "../i18n";

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE_MB = 10;

interface MessageInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  /** Показывать подсказку «Генерация в другом чате» */
  loadingInOtherChat?: boolean;
  disabled: boolean;
  useWebData: boolean;
  forecastMode: boolean;
  onUseWebDataChange: (v: boolean) => void;
  onForecastModeChange: (v: boolean) => void;
  statusText: string;
  error: string | null;
  placeholder?: string;
  images?: string[];
  onImagesChange?: (images: string[]) => void;
  uiLocale: UiLocale;
}

function fileToDataUri(file: File, locale: UiLocale): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      reject(new Error(t(locale, "fileTooBig", { max: String(MAX_IMAGE_SIZE_MB) })));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function MessageInput(props: MessageInputProps) {
  const {
    value,
    onChange,
    onSubmit,
    loading,
    loadingInOtherChat = false,
    disabled,
    useWebData,
    forecastMode,
    onUseWebDataChange,
    onForecastModeChange,
    statusText,
    error,
    placeholder = "",
    images = [],
    onImagesChange,
    uiLocale
  } = props;

  const canSubmit = value.trim() || images.length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !onImagesChange) return;
    const toAdd = Math.min(MAX_IMAGES - images.length, files.length);
    if (toAdd <= 0) return;
    try {
      const newUris: string[] = [];
      for (let i = 0; i < toAdd; i++) {
        const uri = await fileToDataUri(files[i], uiLocale);
        if (uri.startsWith("data:image/")) newUris.push(uri);
      }
      onImagesChange([...images, ...newUris].slice(0, MAX_IMAGES));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t(uiLocale, "uploadError");
      onChange(value + (value ? "\n" : "") + `[${msg}]`);
    }
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    onImagesChange?.(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="message-input">
      <div className="message-input-chips">
        <label className="chip">
          <input
            type="checkbox"
            checked={useWebData}
            onChange={(e) => onUseWebDataChange(e.target.checked)}
            disabled={loading}
          />
          <span>{t(uiLocale, "useWebData")}</span>
        </label>
        <label className="chip">
          <input
            type="checkbox"
            checked={forecastMode}
            onChange={(e) => onForecastModeChange(e.target.checked)}
            disabled={loading}
          />
          <span>{t(uiLocale, "forecast")}</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="message-input-file-hidden"
          onChange={handleFileChange}
          disabled={loading || disabled || images.length >= MAX_IMAGES}
        />
        <button
          type="button"
          className="chip message-input-attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || disabled || images.length >= MAX_IMAGES}
          title={t(uiLocale, "attachImage")}
        >
          📷 {t(uiLocale, "image")}
        </button>
      </div>
      {images.length > 0 && (
        <div className="message-input-previews">
          {images.map((uri, i) => (
            <div key={i} className="message-input-preview">
              <img src={uri} alt="" />
              <button type="button" onClick={() => removeImage(i)} aria-label={t(uiLocale, "delete")}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {loadingInOtherChat && (
        <p className="message-input-loading-other">{t(uiLocale, "loadingInOtherChat")}</p>
      )}
      <div className="message-input-row">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || loading}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || loading || !canSubmit}
          className="message-input-submit"
        >
          {loading ? statusText || "..." : t(uiLocale, "submit")}
        </button>
      </div>
      {error && <div className="message-input-error">{error}</div>}
      <p className="message-input-hint">
        {t(uiLocale, "legalHint")}
      </p>
    </div>
  );
}
