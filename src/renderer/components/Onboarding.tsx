import { useState, useEffect } from "react";
import type { UiLocale } from "./LanguageSelector";
import { t } from "../i18n";

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
}

const PROFILES = [
  {
    id: "light" as const,
    emoji: "🐢",
    label: { ru: "Слабый CPU (4–8 GB RAM)", en: "Light CPU (4–8 GB RAM)", zh: "低配 CPU (4–8 GB)" },
    desc: { ru: "phi3 — быстрый, лёгкий", en: "phi3 — fast & light", zh: "phi3 — 快速轻量" },
    models: ["phi3"]
  },
  {
    id: "medium" as const,
    emoji: "⚡",
    label: { ru: "Средний CPU (8–16 GB)", en: "Medium CPU (8–16 GB)", zh: "中配 CPU (8–16 GB)" },
    desc: { ru: "mistral + phi3 — баланс", en: "mistral + phi3 — balanced", zh: "mistral + phi3 — 平衡" },
    models: ["phi3", "mistral"]
  },
  {
    id: "powerful" as const,
    emoji: "🚀",
    label: { ru: "Мощный GPU (16+ GB)", en: "Powerful GPU (16+ GB)", zh: "强力 GPU (16+ GB)" },
    desc: { ru: "mistral + llama3.1 — максимум", en: "mistral + llama3.1 — max quality", zh: "mistral + llama3.1 — 最佳" },
    models: ["phi3", "mistral", "llama3.1"]
  }
];

type Step = "welcome" | "check" | "profile" | "install" | "done";

export default function Onboarding({ uiLocale, onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<"light" | "medium" | "powerful">("medium");
  const [pullProgress, setPullProgress] = useState<Record<string, PullProgress>>({});
  const [installing, setInstalling] = useState(false);

  const loc = uiLocale;

  useEffect(() => {
    if (step === "check") {
      window.api.checkOllama().then((s) => {
        setStatus(s);
        if (s.installed && s.running) {
          // Already good, skip to profile
          setStep("profile");
        }
      });
    }
  }, [step]);

  const startInstall = async () => {
    setInstalling(true);
    setStep("install");
    const profile = PROFILES.find((p) => p.id === selectedProfile)!;
    for (const model of profile.models) {
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
    window.api.saveOnboardingProfile(selectedProfile);
  };

  const skip = () => {
    window.api.saveOnboardingProfile(selectedProfile);
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
              <div className="onboarding-feature">🔒 {loc === "ru" ? "100% локально — данные не покидают компьютер" : loc === "zh" ? "100% 本地 — 数据不离开电脑" : "100% local — data never leaves your computer"}</div>
              <div className="onboarding-feature">🤝 {loc === "ru" ? "4 агента спорят и дают взвешенный ответ" : loc === "zh" ? "4个智能体争论并给出均衡答案" : "4 agents debate and give a balanced answer"}</div>
              <div className="onboarding-feature">🌐 {loc === "ru" ? "Поиск в интернете + анализ картинок" : loc === "zh" ? "网络搜索 + 图像分析" : "Web search + image analysis"}</div>
            </div>
            <button className="onboarding-btn-primary" onClick={() => setStep("check")}>
              {loc === "ru" ? "Начать настройку" : loc === "zh" ? "开始设置" : "Start Setup"}
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
                  if (s.running) setStep("profile");
                }}>
                  {loc === "ru" ? "Запустить Ollama" : loc === "zh" ? "启动 Ollama" : "Start Ollama"}
                </button>
              </div>
            )}
          </div>
        )}

        {step === "profile" && (
          <div className="onboarding-step">
            <div className="onboarding-logo">⚙️</div>
            <h2>{loc === "ru" ? "Выберите профиль железа" : loc === "zh" ? "选择硬件配置" : "Select your hardware profile"}</h2>
            <p className="onboarding-subtitle" style={{ marginBottom: 24 }}>
              {loc === "ru" ? "Мы подберём оптимальные модели под ваш компьютер." : loc === "zh" ? "我们将为您的电脑选择最优模型。" : "We'll pick optimal models for your hardware."}
            </p>
            <div className="onboarding-profiles">
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  className={`onboarding-profile-card ${selectedProfile === p.id ? "onboarding-profile-card--active" : ""}`}
                  onClick={() => setSelectedProfile(p.id)}
                >
                  <span className="onboarding-profile-emoji">{p.emoji}</span>
                  <span className="onboarding-profile-label">{p.label[loc] || p.label.en}</span>
                  <span className="onboarding-profile-desc">{p.desc[loc] || p.desc.en}</span>
                </button>
              ))}
            </div>
            <button className="onboarding-btn-primary" onClick={startInstall}>
              {loc === "ru" ? "Установить модели" : loc === "zh" ? "安装模型" : "Install models"}
            </button>
            <button className="onboarding-btn-link" onClick={skip}>
              {loc === "ru" ? "Пропустить" : loc === "zh" ? "跳过" : "Skip"}
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
              {PROFILES.find((p) => p.id === selectedProfile)!.models.map((model) => {
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
