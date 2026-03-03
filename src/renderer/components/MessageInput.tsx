import { useRef } from "react";
import type { UiLocale } from "./LanguageSelector";
import { t } from "../i18n";
import { useSTT, sttLangCode } from "../hooks/useSpeech";

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE_MB = 10;

interface MessageInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  loading: boolean;
  loadingInOtherChat?: boolean;
  disabled: boolean;
  useWebData: boolean;
  forecastMode: boolean;
  deepResearchMode: boolean;
  onUseWebDataChange: (v: boolean) => void;
  onForecastModeChange: (v: boolean) => void;
  onDeepResearchModeChange: (v: boolean) => void;
  statusText: string;
  error: string | null;
  placeholder?: string;
  images?: string[];
  onImagesChange?: (images: string[]) => void;
  uiLocale: UiLocale;
  onOpenMemory?: () => void;
  expertProfile?: string;
  onExpertProfileChange?: (id: string) => void;
  /** Pro-only feature flags (default true for backward compat) */
  canUseWebData?: boolean;
  canUseForecast?: boolean;
  canUseExpertProfile?: boolean;
  canUseMemory?: boolean;
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
    onStop,
    loading,
    loadingInOtherChat = false,
    disabled,
    useWebData,
    forecastMode,
    deepResearchMode,
    onUseWebDataChange,
    onForecastModeChange,
    onDeepResearchModeChange,
    statusText,
    error,
    placeholder = "",
    images = [],
    onImagesChange,
    uiLocale,
    onOpenMemory,
    expertProfile = "",
    onExpertProfileChange,
    canUseWebData = true,
    canUseForecast = true,
    canUseExpertProfile = true,
    canUseMemory = true
  } = props;

  const canSubmit = value.trim() || images.length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { start: startSTT, stop: stopSTT, listening, loading: sttLoading, error: sttError } = useSTT();

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

  const handleVoice = () => {
    if (listening) {
      stopSTT();
    } else {
      startSTT(sttLangCode(uiLocale), (text) => onChange(value + (value ? " " : "") + text));
    }
  };

  const expertLabel = (id: string) => {
    const labels: Record<string, Record<string, string>> = {
      "": { ru: "👤 Роль", en: "👤 Role", zh: "👤 角色" },
      lawyer: { ru: "⚖️ Юрист", en: "⚖️ Lawyer", zh: "⚖️ 律师" },
      doctor: { ru: "🏥 Врач", en: "🏥 Doctor", zh: "🏥 医生" },
      investor: { ru: "📈 Инвестор", en: "📈 Investor", zh: "📈 投资者" },
      developer: { ru: "💻 Dev", en: "💻 Dev", zh: "💻 开发" },
      teacher: { ru: "📚 Учитель", en: "📚 Teacher", zh: "📚 教师" },
      marketer: { ru: "📣 Маркетолог", en: "📣 Marketer", zh: "📣 营销" }
    };
    return labels[id]?.[uiLocale] ?? labels[id]?.en ?? "👤 Role";
  };

  const nextExpert = () => {
    const order = ["", "lawyer", "doctor", "investor", "developer", "teacher", "marketer"];
    const cur = order.indexOf(expertProfile);
    onExpertProfileChange?.(order[(cur + 1) % order.length]);
  };

  return (
    <div className="message-input">
      <div className="message-input-chips">
        <label
          className={`chip ${!canUseWebData ? "chip--locked" : ""}`}
          title={!canUseWebData ? t(uiLocale, "featureProOnly") : undefined}
        >
          <input
            type="checkbox"
            checked={useWebData}
            onChange={(e) => onUseWebDataChange(e.target.checked)}
            disabled={loading || !canUseWebData}
          />
          <span>{t(uiLocale, "useWebData")}</span>
        </label>
        <label
          className={`chip ${!canUseForecast ? "chip--locked" : ""}`}
          title={!canUseForecast ? t(uiLocale, "featureProOnly") : undefined}
        >
          <input
            type="checkbox"
            checked={forecastMode}
            onChange={(e) => onForecastModeChange(e.target.checked)}
            disabled={loading || !canUseForecast}
          />
          <span>{t(uiLocale, "forecast")}</span>
        </label>
        <label className="chip">
          <input
            type="checkbox"
            checked={deepResearchMode}
            onChange={(e) => onDeepResearchModeChange(e.target.checked)}
            disabled={loading}
          />
          <span>{t(uiLocale, "deepResearch")}</span>
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
        {/* Memory button */}
        {onOpenMemory && canUseMemory && (
          <button type="button" className="chip" onClick={onOpenMemory} title={uiLocale === "ru" ? "Личная память" : "Memory"}>
            🧠
          </button>
        )}
        {/* Expert profile cycle button */}
        {onExpertProfileChange && (
          <button
            type="button"
            className={`chip ${expertProfile ? "chip--active" : ""} ${!canUseExpertProfile ? "chip--locked" : ""}`}
            onClick={canUseExpertProfile ? nextExpert : undefined}
            disabled={loading || !canUseExpertProfile}
            title={!canUseExpertProfile ? t(uiLocale, "featureProOnly") : uiLocale === "ru" ? "Эксперт" : uiLocale === "zh" ? "专家" : "Expert"}
          >
            {expertLabel(expertProfile)}
          </button>
        )}
        {/* Voice input button */}
        <button
          type="button"
          className={`chip ${listening ? "chip--recording" : ""}`}
          onClick={handleVoice}
          disabled={loading || disabled || sttLoading}
          title={
            sttLoading
              ? uiLocale === "ru"
                ? "Загрузка модели..."
                : uiLocale === "zh"
                  ? "加载模型中..."
                  : "Loading model..."
              : uiLocale === "ru"
                ? "Голосовой ввод"
                : uiLocale === "zh"
                  ? "语音输入"
                  : "Voice input"
          }
        >
          {sttLoading ? "⏳" : listening ? "🔴" : "🎤"}
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
              if (!loading) onSubmit();
            }
            if (e.key === "Escape" && loading) {
              onStop?.();
            }
          }}
          placeholder={
            listening
              ? uiLocale === "ru"
                ? "Говорите... (нажмите 🎤 для остановки)"
                : uiLocale === "zh"
                  ? "说话... (点击 🎤 停止)"
                  : "Speak... (click 🎤 to stop)"
              : placeholder
          }
          rows={1}
          disabled={disabled || loading}
        />
        {loading ? (
          <button
            type="button"
            onClick={onStop}
            className="message-input-stop"
            title={uiLocale === "ru" ? "Остановить (Esc)" : uiLocale === "zh" ? "停止 (Esc)" : "Stop (Esc)"}
          >
            ⏹ {uiLocale === "ru" ? "Стоп" : uiLocale === "zh" ? "停止" : "Stop"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || !canSubmit}
            className="message-input-submit"
          >
            {t(uiLocale, "submit")}
          </button>
        )}
      </div>
      {(error || sttError) && (
        <div className="message-input-error">{error || sttError}</div>
      )}
      <p className="message-input-hint">
        {t(uiLocale, "legalHint")}
      </p>
    </div>
  );
}
