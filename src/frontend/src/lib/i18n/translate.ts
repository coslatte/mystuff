import { catalogs, sourceMessages } from "./catalog";
import { journeyTranslations } from "./journey";
import type { Locale, MessageKey, MessageArguments } from "./types";

const englishKeys = new Map(Object.entries(sourceMessages).map(([key, text]) => [text, key]));
const journey = new Map<string, Record<Locale, string>>(
  journeyTranslations.map(([english, spanish]) => [
    english,
    { en: english, es: spanish, fr: english, de: english, ja: english },
  ]),
);

export function translate<Key extends MessageKey>(
  key: Key,
  locale: Locale,
  ...[params]: MessageArguments<Key>
): string {
  return interpolate(catalogs[locale][key], params ?? {});
}

export function translateText(
  value: string,
  locale: Locale,
  params: Record<string, string | number> = {},
): string {
  const key = isMessageKey(value) ? value : englishKeys.get(value);
  if (key && isMessageKey(key)) return interpolate(catalogs[locale][key], params);

  const editorial = journey.get(value);
  return editorial ? editorial[locale] : value;
}

function isMessageKey(value: string): value is MessageKey {
  return Object.hasOwn(sourceMessages, value);
}

function interpolate(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    String(params[name] ?? placeholder),
  );
}
