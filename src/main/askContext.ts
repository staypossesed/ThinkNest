/** Текущий preferredLocale во время ask — можно обновить сменой языка в UI */
let currentPreferredLocale: string | null = null;
let askInProgress = false;

export function setAskLocale(locale: string): void {
  currentPreferredLocale = locale;
}

export function getAskLocale(): string | null {
  return currentPreferredLocale;
}

export function beginAsk(): void {
  askInProgress = true;
}

export function clearAskLocale(): void {
  askInProgress = false;
  currentPreferredLocale = null;
}

export function updateAskLocaleIfActive(locale: string): void {
  if (askInProgress) currentPreferredLocale = locale;
}
