# Frontend architecture

Astro 5 + React 19 islands + Tailwind 4, deployed to Vercel. The API is a Spring
Boot app on Render; Postgres and audio storage are on Supabase.

This document is the decision record: what belongs in which file, why, and which
mistakes the layout already exists to prevent. New code should be able to place
itself by reading the rules below.

## Deployment shape

| Piece | Where | Config |
| --- | --- | --- |
| Frontend | Vercel | `frontend/vercel.json` (`bun install`, `astro build`) |
| API | Render | Spring Boot, no `render.yaml` in the repo |
| Database + audio | Supabase | `backend/src/main/resources/application.yml` |
| CI | GitHub Actions | `.github/workflows/ci.yml`, on `master` |

The API parks between requests on free hosting, so its cold start can reach
30-60 seconds. That single fact drives every rendering decision below.

## The five rules

**1. Astro-first, top down.** Write `.astro`. Reach for `.tsx` only when a
component needs client state — and only at the boundary of the interactive
region, not underneath it. Once something renders inside a React island it has
to stay React: an `.astro` component cannot be a child of a `.tsx` one.

**2. Live data never renders on the server while the API sleeps.** `/` renders
on demand (`prerender = false`) because GitHub answers fast. `/music` fetches
its tracks from the browser instead, because an SSR request would block on a
cold start that outlasts the Vercel function timeout. Do not "improve" this by
moving `/music` to SSR.

**3. One `.tsx` root per island.** `MusicSection` and `AdminUpload` are the only
interactive roots, and both are mounted with `client:load`. Their children are
React for the reason in rule 1, not because they each need their own state.

**4. The API contract is generated, never transcribed.** `src/types/index.ts`
aliases the OpenAPI schema instead of restating the Java DTOs. See
`src/lib/api/README.md`.

**5. `.astro` never imports anything browser-only.** `services/github.ts` reads
a server secret and runs during the prerender of `/`. Nothing in a client bundle
may reach it. `lib/now-playing-element.ts` is the mirror image: browser-only, and
must not be imported from an `.astro` frontmatter block.

## Where things go

```
src/
  pages/        Astro routes. Server data fetching happens here.
  layouts/      Document shell.
  components/
    *.astro     Server-rendered, no client state.
    *.tsx       Inside a React island.
  hooks/        One hook per concern: useResource, useSongs, useAlbums,
                useServerWarmup, usePlayer.
  lib/          Framework-free and reusable: storage, optimistic, playback-canvas,
                playback-ui, visitor, now-playing-element.
  data/         Pure domain transforms over API types.
  services/     I/O: api.ts (client), github.ts (server-only), player.ts.
  types/        Contract re-exports plus client-side domain types.
  styles/       global.css holds the theme and the shared @utility surfaces.
```

### Why `services/player.ts` is a class and not a hook

`PlayerEngine` is a module-level singleton because two rendering systems must
observe the same playback state: the React `PlayerBar` and the
`now-playing-el` custom element in the footer. `usePlayer` bridges it with
`useSyncExternalStore`. Replacing the store with React context would force the
footer widget to hydrate React on every page, which is the cost the custom
element exists to avoid.

### Why the footer uses a custom element

`Footer.astro` renders on all three pages, including `/` where no React island
exists. Hydrating `react-dom` for one 30px widget would be the larger cost. The
element subscribes to the same store as `PlayerBar`, so the two cannot drift.

Rendered once. It used to also appear inside `MusicSection`, which put two
copies of the widget on `/music`.

## Shared primitives

Four helpers replace code that used to be copied around.

`useResource` owns the `{data, loading, error, reload}` lifecycle for every
remote read. It also exposes `setData` as an updater, which is what lets an
optimistic mutation patch the same state the loader wrote.

`runOptimistic` runs the four steps of an optimistic mutation — paint, send,
reconcile, roll back — and reports the failure. Callers supply only their own
state transitions. The rating average arithmetic lives next to it as
`applyVote`, a pure function.

`lib/storage.ts` wraps `localStorage` once. Every caller needs the same three
guards: no `localStorage` during SSR, Safari's private mode throwing on write,
and a corrupted value never taking the page down.

`@utility` rules in `global.css` hold the repeated brutalist surfaces
(`brut-field`, `brut-panel`, `brut-chip`, `brut-label`, `brut-meta`). They are
structural only; size and colour overrides stay at the call site so a utility
never fights a breakpoint variant.

## Environment variables

Declared in `env.schema` in `astro.config.mjs` and consumed through
`astro:env/client` or `astro:env/server`. This is what makes them typed. Plain
`import.meta.env.X` falls back to Vite's `any` index signature, so a typo in
`.env` compiles and then returns `undefined` at runtime.

`GITHUB_TOKEN` is server-only. `PUBLIC_API_URL` is public and defaulted in the
schema.

## Regenerating API types

```bash
docker compose up -d
powershell -ExecutionPolicy Bypass -File backend/run.ps1
cd frontend && bun run gen:api
```

Required after changing any DTO, controller signature or `ResponseEntity<?>`
return type. Details and the known gap around error bodies:
`src/lib/api/README.md`.

## Known constraints

- **No tests.** The pure pieces (`applyVote`, `runOptimistic`, `playback-canvas`,
  `streaming-albums`, `errors`) are already shaped for them.
- **No linter.** `bun run check` is the only gate; it must run before every
  commit, not just in CI.
- **No path aliases.** Imports are relative, which is why the layers above are
  shallow on purpose.
