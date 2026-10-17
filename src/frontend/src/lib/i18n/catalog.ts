import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { de } from "./de";
import { ja } from "./ja";
import type { Locale, MessageReferences, TranslationCatalog } from "./types";

// Object.fromEntries erases the literal keys constructed from the English schema.
export const messages = Object.fromEntries(
  Object.entries(en).map(([section, fields]) => [
    section,
    Object.fromEntries(Object.keys(fields).map(field => [field, `${section}.${field}`])),
  ]),
) as MessageReferences;

function flattenCatalog(catalog: TranslationCatalog): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(catalog).flatMap(([section, fields]) =>
      Object.entries(fields).map(([field, text]) => [`${section}.${field}`, text]),
    ),
  );
}

export const sourceMessages = flattenCatalog(en);
export const catalogs = {
  en: sourceMessages,
  es: flattenCatalog(es),
  fr: flattenCatalog(fr),
  de: flattenCatalog(de),
  ja: flattenCatalog(ja),
} satisfies Record<Locale, Readonly<Record<string, string>>>;
