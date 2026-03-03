/** Текущий preferredLocale во время ask — можно обновить сменой языка в UI */
let currentPreferredLocale: string | null = null;
let askInProgress = false;
let currentAbortController: AbortController | null = null;

export function setAskLocale(locale: string): void {
  currentPreferredLocale = locale;
}

export function getAskLocale(): string | null {
  return currentPreferredLocale;
}

export function beginAsk(): void {
  askInProgress = true;
  currentAbortController = new AbortController();
}

export function getAskSignal(): AbortSignal | null {
  return currentAbortController?.signal ?? null;
}

/** Вызвать пользователем для остановки генерации */
export function stopAsk(): void {
  if (currentAbortController) {
    currentAbortController.abort("user-stop");
  }
}

export function clearAskLocale(): void {
  askInProgress = false;
  currentPreferredLocale = null;
  currentAbortController = null;
}

export function updateAskLocaleIfActive(locale: string): void {
  if (askInProgress) currentPreferredLocale = locale;
}
