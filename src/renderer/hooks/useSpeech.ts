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

/** STT: распознаёт голос через браузерный SpeechRecognition */
export function useSTT() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const start = useCallback((lang = "ru-RU", onResult?: (text: string) => void) => {
    const SpeechRecognition =
      window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      const text = final || interim;
      setTranscript(text);
      if (final && onResult) onResult(final);
    };

    recognitionRef.current = rec;
    rec.start();
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { start, stop, listening, transcript };
}

export function sttLangCode(uiLocale: string): string {
  if (uiLocale === "ru") return "ru-RU";
  if (uiLocale === "zh") return "zh-CN";
  return "en-US";
}
