import { useSyncExternalStore } from "react";
import { translate } from "../lib/i18n";
import { getLocale, getServerLocale, subscribeLocale } from "../services/locale";

export function useTranslations() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
  return <T,>(value: T) => translate(value, locale);
}
