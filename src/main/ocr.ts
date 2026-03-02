import { createWorker } from "tesseract.js";

const workerByLang = new Map<string, Promise<Awaited<ReturnType<typeof createWorker>>>>();

async function getWorker(lang: string): Promise<Awaited<ReturnType<typeof createWorker>>> {
  let existing = workerByLang.get(lang);
  if (!existing) {
    existing = createWorker(lang, 1, {
      logger: () => {}
    });
    workerByLang.set(lang, existing);
  }
  return existing;
}

/**
 * OCR через Tesseract.js — извлекает текст с картинок.
 * Локально, без API. Поддерживает русский и английский.
 */
export async function extractTextFromImages(
  images: string[],
  lang = "rus+eng"
): Promise<string> {
  const valid = images.filter((s) => s?.startsWith("data:image/"));
  if (valid.length === 0) return "";

  const worker = await getWorker(lang);
  const results: string[] = [];
  for (const dataUri of valid) {
    const { data } = await worker.recognize(dataUri);
    const text = (data.text ?? "").trim();
    if (text) results.push(text);
  }
  return results.join("\n\n---\n\n");
}
