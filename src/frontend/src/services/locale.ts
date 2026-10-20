import { isLocale, type Locale } from "../lib/i18n/types";
import { readText, writeText } from "./storage";

const listeners = new Set<() => void>();
let locale: Locale = "en";

export const getLocale = () => locale;
export const getServerLocale = (): Locale => "en";

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setLocale(next: Locale) {
  locale = next;
  writeText("cosmiclatte.locale", next);
  listeners.forEach(listener => listener());
}

export function restoreLocale() {
  const stored = readText("cosmiclatte.locale");
  const preferred = typeof navigator === "undefined" ? undefined
    : navigator.languages.map(language => language.split("-")[0]).find(isLocale);
  locale = isLocale(stored) ? stored : preferred ?? "en";
}


