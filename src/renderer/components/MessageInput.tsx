import { useRef, useEffect } from "react";
import {
  Globe,
  TrendingUp,
  Search,
  Image as ImageIcon,
  Brain,
  User,
  Mic,
  Send,
  Square,
  X
} from "lucide-react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { start: startSTT, stop: stopSTT, listening, loading: sttLoading, error: sttError } = useSTT();

  // Auto-resize textarea; collapse to small when value is empty (e.g. after submit)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!value.trim()) {
      el.style.height = "auto";
      el.style.height = "44px";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

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
      "": { ru: "Роль", en: "Role", zh: "角色" },
      lawyer: { ru: "Юрист", en: "Lawyer", zh: "律师" },
      doctor: { ru: "Врач", en: "Doctor", zh: "医生" },
      investor: { ru: "Инвестор", en: "Investor", zh: "投资者" },
      developer: { ru: "Dev", en: "Dev", zh: "开发" },
      teacher: { ru: "Учитель", en: "Teacher", zh: "教师" },
      marketer: { ru: "Маркетолог", en: "Marketer", zh: "营销" }
    };
    return labels[id]?.[uiLocale] ?? labels[id]?.en ?? "Role";
  };

  const nextExpert = () => {
    const order = ["", "lawyer", "doctor", "investor", "developer", "teacher", "marketer"];
    const cur = order.indexOf(expertProfile);
    onExpertProfileChange?.(order[(cur + 1) % order.length]);
  };

  const placeholderText = listening
    ? uiLocale === "ru"
      ? "Говорите... (нажмите 🎤 для остановки)"
      : uiLocale === "zh"
        ? "说话... (点击 🎤 停止)"
        : "Speak... (click 🎤 to stop)"
    : placeholder;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-2">
      <div className="flex flex-nowrap items-center gap-2 mb-4 overflow-x-auto py-2">
        <label
          className={`input-chip cursor-pointer border backdrop-blur-xl transition-colors duration-200 ${
            !canUseWebData
              ? "cursor-not-allowed border-white/10 bg-white/5 opacity-50"
              : useWebData
                ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                : "border-white/20 bg-white/[0.08] text-gray-300 hover:border-white/30 hover:bg-white/12 hover:text-white"
          }`}
          title={!canUseWebData ? t(uiLocale, "featureProOnly") : t(uiLocale, "useWebData")}
        >
          <input
            type="checkbox"
            checked={useWebData}
            onChange={(e) => onUseWebDataChange(e.target.checked)}
            disabled={loading || !canUseWebData}
            className="sr-only"
          />
          <Globe className="input-chip-icon" />
          {t(uiLocale, "useWebDataShort")}
        </label>
        <label
          className={`input-chip cursor-pointer border backdrop-blur-xl transition-colors duration-200 ${
            !canUseForecast
              ? "cursor-not-allowed border-white/10 bg-white/5 opacity-50"
              : forecastMode
                ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                : "border-white/20 bg-white/[0.08] text-gray-300 hover:border-white/30 hover:bg-white/12 hover:text-white"
          }`}
          title={!canUseForecast ? t(uiLocale, "featureProOnly") : undefined}
        >
          <input
            type="checkbox"
            checked={forecastMode}
            onChange={(e) => onForecastModeChange(e.target.checked)}
            disabled={loading || !canUseForecast}
            className="sr-only"
          />
          <TrendingUp className="input-chip-icon" />
          {t(uiLocale, "forecast")}
        </label>
        <label
          className={`input-chip cursor-pointer border backdrop-blur-xl transition-colors duration-200 ${
            deepResearchMode
              ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
              : "border-white/20 bg-white/[0.08] text-gray-300 hover:border-white/30 hover:bg-white/12 hover:text-white"
          }`}
          title={t(uiLocale, "deepResearch")}
        >
          <input
            type="checkbox"
            checked={deepResearchMode}
            onChange={(e) => onDeepResearchModeChange(e.target.checked)}
            disabled={loading}
            className="sr-only"
          />
          <Search className="input-chip-icon" />
          {t(uiLocale, "deepResearchShort")}
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="absolute h-0 w-0 opacity-0"
          onChange={handleFileChange}
          disabled={loading || disabled || images.length >= MAX_IMAGES}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || disabled || images.length >= MAX_IMAGES}
          className="input-chip border border-white/20 bg-white/[0.08] text-gray-300 backdrop-blur-xl transition-colors duration-200 hover:border-white/30 hover:bg-white/12 hover:text-white disabled:opacity-50"
          title={t(uiLocale, "attachImage")}
        >
          <ImageIcon className="input-chip-icon" />
          {t(uiLocale, "image")}
        </button>
        {onOpenMemory && canUseMemory && (
          <button
            type="button"
            onClick={onOpenMemory}
            className="input-chip input-chip--icon-only border border-white/20 bg-white/[0.08] text-gray-300 backdrop-blur-xl transition-colors duration-200 hover:border-white/30 hover:bg-white/12 hover:text-white"
            title={uiLocale === "ru" ? "Личная память" : "Memory"}
          >
            <Brain className="input-chip-icon" />
          </button>
        )}
        {onExpertProfileChange && (
          <button
            type="button"
            onClick={canUseExpertProfile ? nextExpert : undefined}
            disabled={loading || !canUseExpertProfile}
            className={`input-chip cursor-pointer border backdrop-blur-xl transition-colors duration-200 ${
              !canUseExpertProfile
                ? "cursor-not-allowed border-white/10 bg-white/5 opacity-50 text-gray-400"
                : expertProfile
                  ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                  : "border-white/20 bg-white/[0.08] text-gray-300 hover:border-white/30 hover:bg-white/12 hover:text-white"
            }`}
            title={!canUseExpertProfile ? t(uiLocale, "featureProOnly") : "Expert"}
          >
            <User className="input-chip-icon" />
            {expertLabel(expertProfile)}
          </button>
        )}
        <button
          type="button"
          onClick={handleVoice}
          disabled={loading || disabled || sttLoading}
          className={`input-chip input-chip--icon-only cursor-pointer border backdrop-blur-xl transition-colors duration-200 ${
            listening
              ? "border-red-500/40 bg-red-500/15 text-red-400 animate-pulse"
              : "border-white/20 bg-white/[0.08] text-gray-300 hover:border-white/30 hover:bg-white/12 hover:text-white disabled:opacity-50"
          }`}
          title={
            sttLoading
              ? "Loading..."
              : uiLocale === "ru"
                ? "Голосовой ввод"
                : uiLocale === "zh"
                  ? "语音输入"
                  : "Voice input"
          }
        >
          {sttLoading ? (
            <span className="input-chip-icon flex items-center justify-center animate-spin">⏳</span>
          ) : (
            <Mic className="input-chip-icon" />
          )}
        </button>
      </div>

      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {images.map((uri, i) => (
            <div key={i} className="relative">
              <img
                src={uri}
                alt=""
                className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 text-white transition-colors hover:bg-red-500"
                aria-label={t(uiLocale, "delete")}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {loadingInOtherChat && (
        <p className="mb-2 text-sm text-amber-400">{t(uiLocale, "loadingInOtherChat")}</p>
      )}

      <div
        className="flex gap-3 rounded-2xl border border-white/15 bg-white/[0.08] p-2.5 backdrop-blur-2xl"
        style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06)" }}
      >
        <textarea
          ref={textareaRef}
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
          placeholder={placeholderText}
          rows={1}
          disabled={disabled}
          className="input-textarea min-h-[44px] max-h-[200px] flex-1 resize-none overflow-y-auto rounded-xl border-0 bg-transparent px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-0"
        />
        {loading ? (
          <button
            type="button"
            onClick={onStop}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-400 shadow-lg shadow-red-500/20 transition-all hover:bg-red-500/40"
            title="Stop (Esc)"
          >
            <Square className="h-4 w-4" />
            {uiLocale === "ru" ? "Стоп" : uiLocale === "zh" ? "停止" : "Stop"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || !canSubmit}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600"
          >
            <Send className="h-4 w-4" />
            {t(uiLocale, "submit")}
          </button>
        )}
      </div>

      {(error || sttError) && (
        <div className="mt-2 text-sm text-purple-400">{error || sttError}</div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-gray-500/80">
        {t(uiLocale, "legalHint")}
      </p>
    </div>
  );
}
