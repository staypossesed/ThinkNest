import { useCallback, useRef, useState } from "react";

/** TTS: читает текст вслух через браузерный SpeechSynthesis */
export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string, lang = "ru-RU") => {
    window.speechSynthesis?.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/[#*`_>]/g, "").slice(0, 3000));
    utter.lang = lang;
    utter.rate = 1.0;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    utteranceRef.current = utter;
    window.speechSynthesis?.speak(utter);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking };
}

/** STT: MediaRecorder + локальный Whisper (Transformers.js). Web Speech API в Electron не работает. */
export function useSTT() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriberRef = useRef<Awaited<ReturnType<typeof import("@huggingface/transformers").pipeline>> | null>(null);

  const loadTranscriber = useCallback(async () => {
    if (transcriberRef.current) return transcriberRef.current;
    setLoading(true);
    setError(null);
    try {
      const { pipeline } = await import("@huggingface/transformers");
      transcriberRef.current = await pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-base",
        { progress_callback: () => {} }
      );
      return transcriberRef.current;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const start = useCallback(
    async (lang = "ru-RU", onResult?: (text: string) => void) => {
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Microphone not supported");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        streamRef.current = stream;
        chunksRef.current = [];

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 16000 });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          mediaRecorderRef.current = null;
          setListening(false);

          const chunks = chunksRef.current;
          if (chunks.length === 0) return;

          try {
            const transcriber = await loadTranscriber();
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            try {
              const langMap: Record<string, string> = { ru: "russian", en: "english", zh: "chinese" };
              const langCode = langMap[lang.split("-")[0]] ?? "russian";
              const result = await transcriber(url, {
                language: langCode,
                task: "transcribe",
                chunk_length_s: 30,
                stride_length_s: 5
              });
              const raw = result as { text?: string; chunks?: Array<{ text: string }> } | string;
              const text = (typeof raw === "string" ? raw : raw?.text ?? raw?.chunks?.map((c) => c.text).join(" "))?.trim() ?? "";
              if (text) {
                setTranscript(text);
                onResult?.(text);
              }
            } finally {
              URL.revokeObjectURL(url);
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
          }
        };

        recorder.start();
        setListening(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setListening(false);
      }
    },
    [loadTranscriber]
  );

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { start, stop, listening, transcript, loading, error };
}

export function sttLangCode(uiLocale: string): string {
  if (uiLocale === "ru") return "ru-RU";
  if (uiLocale === "zh") return "zh-CN";
  return "en-US";
}
