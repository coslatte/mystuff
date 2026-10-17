export const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
] as const;

export type Locale = (typeof languages)[number]["code"];
type EnglishCatalog = typeof import("./en").en;
export type MessageSection = keyof EnglishCatalog;
export type TranslationCatalog = {
  readonly [Section in MessageSection]: {
    readonly [Field in keyof EnglishCatalog[Section]]: string;
  };
};
export type TranslationSection<Section extends MessageSection> = TranslationCatalog[Section];

export type MessageReferences = {
  readonly [Section in MessageSection]: {
    readonly [Field in keyof EnglishCatalog[Section]]: `${Section}.${Field & string}`;
  };
};
export type MessageKey = {
  [Section in MessageSection]: MessageReferences[Section][keyof MessageReferences[Section]];
}[MessageSection];

type SourceText<Key extends MessageKey> =
  Key extends `${infer Section extends MessageSection}.${infer Field}`
    ? Field extends keyof EnglishCatalog[Section] ? EnglishCatalog[Section][Field] & string : never
    : never;

type Placeholders<Text extends string> =
  Text extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never;

export type MessageParams<Key extends MessageKey> = Record<
  Placeholders<SourceText<Key>>,
  string | number
>;

export type MessageArguments<Key extends MessageKey> =
  keyof MessageParams<Key> extends never
    ? [params?: never]
    : [params: MessageParams<Key>];

export type PlainMessageKey = {
  [Key in MessageKey]: keyof MessageParams<Key> extends never ? Key : never;
}[MessageKey];

export type LocalizedMessage = { id: PlainMessageKey; params?: never } | {
  [Key in Exclude<MessageKey, PlainMessageKey>]: { id: Key; params: MessageParams<Key> };
}[Exclude<MessageKey, PlainMessageKey>];
export type BilingualCopy = readonly [en: string, es: string];

export function isLocale(value: unknown): value is Locale {
  return languages.some((language) => language.code === value);
}
