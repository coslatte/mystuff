import { useSyncExternalStore } from "react";
import { translate, translateText } from "../lib/i18n/translate";
import { getLocale, getServerLocale, subscribeLocale } from "../services/locale";
import type { MessageArguments, MessageKey } from "../lib/i18n/types";

type Translator = (<Key extends MessageKey>(key: Key, ...args: MessageArguments<Key>) => string) & {
  text: (value: string | undefined) => string;
};

export function useTranslations() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
  return Object.assign(
    <Key extends MessageKey>(key: Key, ...args: MessageArguments<Key>) => translate(key, locale, ...args),
    { text: (value: string | undefined) => value ? translateText(value, locale) : "" },
  ) satisfies Translator;
}
