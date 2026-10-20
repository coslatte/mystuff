---
name: translation-sync
description: Keep every supported language in sync whenever user-facing page copy changes. Use when adding, editing, removing, reorganizing, or reviewing visible text, labels, accessible copy, translation catalogs, or localized content. Triggers on: translation, localization, copy, page text, language, locale, i18n, catalog, wording, content edits.
---

# Translation sync

When page copy changes, update its translations in the same change. A wording
edit in one language is still a translation change: preserve the edited source
and bring every corresponding locale up to date.

## Supported locales

The site supports English, Spanish, French, German, and Japanese. Check the
current locale list in `src/frontend/src/lib/i18n/types.ts` before editing.

## Workflow

1. Read `docs/frontend/architecture.md` and inspect the relevant page,
   component, catalog, and localization path before changing copy.
2. Find the existing message field or bilingual content entry. Keep stable
   semantic field names; do not create names from the English sentence or
   duplicate an existing message under a new field.
   Locate the owning named section in `i18n/en.ts` and edit the same section in
   each locale. The nested English object defines the contract. Add source
   messages to its owning section constant. Locale implementations must satisfy
   `TranslationSection` and the complete `TranslationCatalog` derived from English.
3. When copy is added or edited, update the source and corresponding translation
   in all five locale catalogs. When copy is removed, remove its unused catalog
   entries and references across locales.
4. Translate for meaning, tone, and context. Keep artist names, product names,
   URLs, code, and user-provided content intact. Preserve author edits to source
   content; do not rewrite them while translating or reorganizing the data.
5. Render static Astro copy with a generated reference, such as
   `<LocalizedText id={messages.home.aboutTitle} />`, using `data-i18n-*`
   attributes for accessible attributes and metadata. Use references from
   `i18n/catalog.ts` for React translation calls too. Never handwrite dotted
   message IDs or maintain a separate registry; `messages` is generated from
   English. Do not repeat the
   English catalog value as a literal in the template. Use `useTranslations`
   for React-owned interface copy. Keep the source key and all catalog entries
   in sync.
   Preserve named `{parameters}` in every translation. Let `MessageParams`
   infer call arguments from the source; do not bypass it with broad string
   records or casts. Use `PlainMessageKey` for non-parameterized labels.
6. If you edit a bilingual editorial source, update its paired locale copy
   and the equivalent entries for every supported language.
7. Check that the changed text is translated when switching to each locale and
   that switching back restores the source text. Run `bun run check` from
   `src/frontend/`; run `bun run check:i18n` when its browser prerequisites are
   available.

## Existing bilingual content

Some editorial content, including `src/frontend/src/data/music-journey-copy.ts`,
stores authored English and Spanish pairs instead of catalog keys. Preserve
both authored versions. When one side changes, update its paired translation
and provide the equivalent copy for French, German, and Japanese through the
localization structure used by that content. Do not silently leave the other
locales on stale copy or rely on English fallback for newly changed content.

## Completion check

Before finishing, compare the changed source text against every supported
locale, inspect the rendered change path, and report any missing translation
explicitly. Do not mark a copy change complete while a corresponding locale is
still stale.
