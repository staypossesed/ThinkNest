import { useState, useEffect } from "react";
import type { UiLocale } from "./LanguageSelector";
import { t } from "../i18n";

const MODE_STORAGE_KEY = "thinknest_mode";

export type OllamaMode = "fast" | "balanced" | "quality";

/** Модели устанавливаются автоматически — фиксированный набор */
const REQUIRED_MODELS = ["llama3.2:3b", "qwen2.5:3b", "deepseek-r1:7b", "llava"] as const;

interface OllamaStatus {
  installed: boolean;
  running: boolean;
  models: string[];
}

interface PullProgress {
  model: string;
  status: string;
  percent: number;
  done: boolean;
  error?: string;
}

interface OnboardingProps {
  uiLocale: UiLocale;
  onComplete: () => void;
  /** When true, models run on server — skip Ollama setup */
  useServerModels?: boolean;
}

const MODES: Array<{
  id: OllamaMode;
  emoji: string;
  label: Record<"ru" | "en" | "zh", string>;
  desc: Record<"ru" | "en" | "zh", string>;
}> = [
  {
    id: "fast",
    emoji: "⚡",
    label: { ru: "Быстрый", en: "Fast", zh: "快速" },
    desc: {
      ru: "Максимальная скорость, llama3.2",
      en: "Maximum speed, llama3.2",
      zh: "最快速度，llama3.2"
    }
  },
  {
    id: "balanced",
    emoji: "⚖️",
    label: { ru: "Сбалансированный", en: "Balanced", zh: "平衡" },
    desc: {
      ru: "llama3.2 + qwen2.5 — баланс скорости и качества",
      en: "llama3.2 + qwen2.5 — balance of speed and quality",
      zh: "llama3.2 + qwen2.5 — 速度与质量平衡"
    }
  },
  {
    id: "quality",
    emoji: "🎯",
    label: { ru: "Качественный", en: "Quality", zh: "高质量" },
    desc: {
      ru: "llama3.2 — лучшее качество ответов",
      en: "llama3.2 — best answer quality",
      zh: "llama3.2 — 最佳回答质量"
    }
  }
];

type Step = "welcome" | "check" | "mode" | "install" | "done";

export default function Onboarding({ uiLocale, onComplete, useServerModels }: OnboardingProps) {
  const [step, setStep] = useState<Step>(useServerModels ? "welcome" : "welcome");
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [selectedMode, setSelectedMode] = useState<OllamaMode>("balanced");
  const [pullProgress, setPullProgress] = useState<Record<string, PullProgress>>({});
  const [installing, setInstalling] = useState(false);

  const loc = uiLocale;

  useEffect(() => {
    if (step === "check") {
      window.api.checkOllama().then((s) => {
        setStatus(s);
        if (s.installed && s.running) {
          setStep("mode");
        }
      });
    }
  }, [step]);

  const saveMode = (mode: OllamaMode) => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {}
  };

  const isModelInstalled = (m: string) =>
    status?.models.some(
      (installed) => installed.startsWith(m) || m.startsWith(installed.split(":")[0])
    ) ?? false;

  const startInstall = async () => {
    setInstalling(true);
    setStep("install");
    const modelsToInstall = REQUIRED_MODELS.filter((m) => !isModelInstalled(m));
    setPullProgress((prev) => {
      const next = { ...prev };
      for (const m of REQUIRED_MODELS) {
        if (isModelInstalled(m))
          next[m] = { model: m, status: "already installed", percent: 100, done: true };
      }
      return next;
    });
    if (modelsToInstall.length === 0) {
      setInstalling(false);
      setStep("done");
      saveMode(selectedMode);
      return;
    }
    for (const model of modelsToInstall) {
      try {
        await window.api.pullModel(model, (p: PullProgress) => {
          setPullProgress((prev) => ({ ...prev, [model]: p }));
        });
      } catch {
        // continue with next model
      }
    }
    setInstalling(false);
    setStep("done");
    saveMode(selectedMode);
  };

  const skip = () => {
    saveMode(selectedMode);
    onComplete();
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        {step === "welcome" && (
          <div className="onboarding-step">
            <div className="onboarding-logo">🧠</div>
            <h1 className="onboarding-title">
              {loc === "ru" ? "Добро пожаловать в ThinkNest" : loc === "zh" ? "欢迎使用 ThinkNest" : "Welcome to ThinkNest"}
            </h1>
            <p className="onboarding-subtitle">
              {loc === "ru"
                ? "4 эксперта с разными точками зрения отвечают на ваш вопрос — честнее, чем один ChatGPT."
                : loc === "zh"
                  ? "4位专家以不同视角回答您的问题——比单个ChatGPT更诚实。"
                  : "4 experts with different perspectives answer your question — more honest than a single ChatGPT."}
            </p>
            <div className="onboarding-features">
              <div className="onboarding-feature">🔒 {useServerModels ? (loc === "ru" ? "Модели на сервере — ничего устанавливать не нужно" : loc === "zh" ? "模型在服务器上 — 无需安装" : "Models on server — no installation needed") : (loc === "ru" ? "100% локально — данные не покидают компьютер" : loc === "zh" ? "100% 本地 — 数据不离开电脑" : "100% local — data never leaves your computer")}</div>
              <div className="onboarding-feature">🤝 {loc === "ru" ? "4 агента спорят и дают взвешенный ответ" : loc === "zh" ? "4个智能体争论并给出均衡答案" : "4 agents debate and give a balanced answer"}</div>
              <div className="onboarding-feature">🌐 {loc === "ru" ? "Поиск в интернете + анализ картинок" : loc === "zh" ? "网络搜索 + 图像分析" : "Web search + image analysis"}</div>
            </div>
            <button className="onboarding-btn-primary" onClick={() => useServerModels ? onComplete() : setStep("check")}>
              {useServerModels ? (loc === "ru" ? "Начать" : loc === "zh" ? "开始" : "Get Started") : (loc === "ru" ? "Начать настройку" : loc === "zh" ? "开始设置" : "Start Setup")}
            </button>
            <button className="onboarding-btn-link" onClick={skip}>
              {loc === "ru" ? "Пропустить (уже настроено)" : loc === "zh" ? "跳过（已配置）" : "Skip (already set up)"}
            </button>
          </div>
        )}

        {step === "check" && (
          <div className="onboarding-step">
            <div className="onboarding-logo">🔍</div>
            <h2>{loc === "ru" ? "Проверка Ollama..." : loc === "zh" ? "检查 Ollama..." : "Checking Ollama..."}</h2>
            {!status && <div className="onboarding-spinner" />}
            {status && !status.installed && (
              <div className="onboarding-warn">
                <p>{loc === "ru" ? "Ollama не найден. Установите с сайта:" : loc === "zh" ? "未找到 Ollama。请从以下网站安装：" : "Ollama not found. Install from:"}</p>
                <button className="onboarding-btn-link" onClick={() => window.api.openExternal("https://ollama.com")}>
                  ollama.com
                </button>
                <p style={{ marginTop: 12, fontSize: "0.85rem", opacity: 0.7 }}>
                  {loc === "ru" ? "После установки перезапустите ThinkNest." : loc === "zh" ? "安装后重启 ThinkNest。" : "After installing, restart ThinkNest."}
                </p>
                <button className="onboarding-btn-primary" style={{ marginTop: 16 }} onClick={() => window.api.checkOllama().then(setStatus)}>
                  {loc === "ru" ? "Проверить снова" : loc === "zh" ? "重新检查" : "Check again"}
                </button>
              </div>
            )}
            {status?.installed && !status.running && (
              <div>
                <p>{loc === "ru" ? "Ollama установлен, но не запущен. Запускаем..." : loc === "zh" ? "Ollama 已安装但未运行。正在启动..." : "Ollama installed but not running. Starting..."}</p>
                <button className="onboarding-btn-primary" onClick={async () => {
                  await window.api.startOllama();
                  await new Promise(r => setTimeout(r, 2000));
                  const s = await window.api.checkOllama();
                  setStatus(s);
                  if (s.running) setStep("mode");
                }}>
                  {loc === "ru" ? "Запустить Ollama" : loc === "zh" ? "启动 Ollama" : "Start Ollama"}
                </button>
              </div>
            )}
          </div>
        )}

        {step === "mode" && (
          <div className="onboarding-step">
            <div className="onboarding-logo">⚙️</div>
            <h2>{loc === "ru" ? "Выберите режим" : loc === "zh" ? "选择模式" : "Choose your mode"}</h2>
            <p className="onboarding-subtitle" style={{ marginBottom: 24 }}>
              {loc === "ru"
                ? "Режим влияет на скорость и качество ответов. Модели установятся автоматически."
                : loc === "zh"
                  ? "模式影响回答速度和质量。模型将自动安装。"
                  : "Mode affects answer speed and quality. Models will be installed automatically."}
            </p>
            <div className="onboarding-profiles">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={`onboarding-profile-card ${selectedMode === m.id ? "onboarding-profile-card--active" : ""}`}
                  onClick={() => setSelectedMode(m.id)}
                >
                  <span className="onboarding-profile-emoji">{m.emoji}</span>
                  <span className="onboarding-profile-label">{m.label[loc] || m.label.en}</span>
                  <span className="onboarding-profile-desc">{m.desc[loc] || m.desc.en}</span>
                </button>
              ))}
            </div>
            <button className="onboarding-btn-primary" onClick={startInstall}>
              {loc === "ru" ? "Установить модели и начать" : loc === "zh" ? "安装模型并开始" : "Install models & start"}
            </button>
            <button className="onboarding-btn-link" onClick={skip}>
              {loc === "ru" ? "Пропустить (модели уже есть)" : loc === "zh" ? "跳过（已有模型）" : "Skip (models already installed)"}
            </button>
          </div>
        )}

        {step === "install" && (
          <div className="onboarding-step">
            <div className="onboarding-logo">⬇️</div>
            <h2>{loc === "ru" ? "Загружаем модели..." : loc === "zh" ? "正在下载模型..." : "Downloading models..."}</h2>
            <p className="onboarding-subtitle">
              {loc === "ru" ? "Это займёт несколько минут при первой установке." : loc === "zh" ? "首次安装需要几分钟。" : "This may take a few minutes on first install."}
            </p>
            <div className="onboarding-progress-list">
              {REQUIRED_MODELS.map((model) => {
                const p = pullProgress[model];
                return (
                  <div key={model} className="onboarding-progress-item">
                    <div className="onboarding-progress-label">
                      <span>{model}</span>
                      <span>{p ? (p.done ? (p.error ? "❌" : "✅") : `${p.percent}%`) : "⏳"}</span>
                    </div>
                    <div className="onboarding-progress-bar">
                      <div className="onboarding-progress-fill" style={{ width: `${p?.percent ?? 0}%` }} />
                    </div>
                    {p?.status && !p.done && (
                      <div className="onboarding-progress-status">{p.status}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="onboarding-step">
            <div className="onboarding-logo">🎉</div>
            <h2>{loc === "ru" ? "Всё готово!" : loc === "zh" ? "准备完成！" : "You're all set!"}</h2>
            <p className="onboarding-subtitle">
              {loc === "ru" ? "ThinkNest готов к работе. Задайте свой первый вопрос!" : loc === "zh" ? "ThinkNest 已准备就绪。提出您的第一个问题！" : "ThinkNest is ready. Ask your first question!"}
            </p>
            <button className="onboarding-btn-primary" onClick={onComplete}>
              {loc === "ru" ? "Начать" : loc === "zh" ? "开始" : "Get Started"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
