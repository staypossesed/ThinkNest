/**
 * Debug logging — enable via ?debug=1 or localStorage thinknest_debug=1
 */
const DEBUG_KEY = "thinknest_debug";

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(DEBUG_KEY) === "1") return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      localStorage.setItem(DEBUG_KEY, "1");
      return true;
    }
  } catch {}
  return false;
}

export function debug(tag: string, ...args: unknown[]): void {
  if (isEnabled()) {
    console.log(`[ThinkNest:${tag}]`, ...args);
  }
}

export function debugWarn(tag: string, ...args: unknown[]): void {
  if (isEnabled()) {
    console.warn(`[ThinkNest:${tag}]`, ...args);
  }
}

export function debugError(tag: string, ...args: unknown[]): void {
  console.error(`[ThinkNest:${tag}]`, ...args);
}
