# Frontend architecture

Astro 5 + React 19 islands + Tailwind 4, deployed to Vercel. The API is a Spring
Boot app on Render; Postgres and audio storage are on Supabase.

This document is a **living** decision record. It has three jobs:

1. The rules a change has to obey.
2. The map that tells you where a change belongs.
3. The reasoning, so the rules survive the person who wrote them.

If you make a change that moves a file, breaks a rule, or settles an open
question, update this document in the same commit. A stale architecture document
is worse than none, because it will be trusted.

- [How to use this document](#how-to-use-this-document)
- [System shape](#system-shape)
- [The rules](#the-rules)
- [Dependency direction](#dependency-direction)
- [Where to go](#where-to-go)
- [File index](#file-index)
- [Decisions](#decisions)
- [Dead code](#dead-code)
- [Known constraints](#known-constraints)

## How to use this document

Read it in this order, and stop as soon as you have your answer.

| You want to | Go to |
| --- | --- |
| add a component | [The rules](#the-rules), then [Where to go](#where-to-go) |
| decide what lives on which route | [ADR-012](#adr-012--the-routes-are-the-sections) |
| change how data is fetched | [Rule 2](#rule-2--live-data-does-not-block-the-server), [Rule 5](#rule-5--the-server-client-line-is-not-negotiable) |
| add a hook, service or lib | [Dependency direction](#dependency-direction) |
| rename or move a file | [File index](#file-index), [ADR-006](#adr-006-layer-over-subfolder) |
| understand a comment | [Rule 6](#rule-6--comments-explain-why-or-do-not-exist) |
| know what is safe to delete | [Dead code](#dead-code) |
| add a page | [Rule 1](#rule-1-astro-first-top-down), [Rule 3](#rule-3-one-tsx-root-per-island) |

## System shape

| Piece | Where | Config |
| --- | --- | --- |
| Frontend | Vercel | `src/frontend/vercel.json` (`bun install`, `astro build`), Node pinned to 22 in `package.json` because `@astrojs/vercel` 8 only knows 18/20/22 and warns on anything newer |
| API | Render | Spring Boot, `com.cosmiclatte.dev.portfolio`, no `render.yaml` in the repo |
| Database + audio | Supabase | `src/backend/src/main/resources/application.yml` |
| CI | GitHub Actions | `.github/workflows/ci.yml`, on `master` |

The API can park between requests on free hosting, so its cold start can reach
30-60 seconds. External monitoring can reduce idle suspensions, but cold-start
handling remains necessary after restarts or interruptions to monitoring.

### Configure external uptime monitoring

Use the existing `GET /health` endpoint for UptimeRobot. `HealthController`
returns HTTP `200` with `success: true` and `data.status: "ok"` without database
queries. This checks application liveness, not database or audio availability.

1. Copy the backend's public HTTPS URL from the Render dashboard.
2. Open that URL with `/health` appended. Allow the first request to finish if
   Render needs to start the service.
3. Confirm HTTP `200` and the following response:

   ```json
   {"success":true,"message":null,"data":{"status":"ok","service":"cosmiclatteweb"},"meta":null,"errors":null}
   ```

4. In UptimeRobot, create an **HTTP(s)** monitor named `CosmicLatte API`.
5. Set its URL to the backend's public HTTPS URL followed by `/health`.
   Use the Render backend directly. The Vercel frontend does not wake the API.
6. Set the monitoring interval to **5 minutes**. Use **GET** if the interface
   offers a method setting. No authentication or custom headers are required.
7. Enable email alerts for downtime and recovery, then activate the monitor.
8. Confirm that UptimeRobot reports **Up** and receives successful checks over
   at least two intervals. Recheck the monitor URL if the Render hostname changes.

UptimeRobot runs independently of visitors, local computers, and CI. This setup
requires no frontend timer, repository secret, or scheduled GitHub Actions job.
Creating the monitor is an account-level step. Repository configuration alone
does not activate it.

The [UptimeRobot free interval](https://help.uptimerobot.com/en/articles/11360876-what-is-a-monitoring-interval-in-uptimerobot)
is five minutes. Under [Render's free service limits](https://render.com/docs/free),
15 minutes without inbound traffic can suspend the API. Periodic successful
checks can avoid that idle suspension, but Render can still restart the service.
Free instance hours are shared across the workspace, with 750 hours per calendar
month. A service running throughout a 31-day month uses 744 hours. Review usage
in Render's billing dashboard, especially if the workspace has other services.
Keep the existing warmup, retry, and error states for interruptions.

## The rules

These are enforceable. If a change needs one of them broken, the change is wrong
or the rule is wrong — decide which, in writing, and update this section.

### Rule 1 — Astro-first, top down

Write `.astro`. Reach for `.tsx` only when a component needs client state, and
only at the **boundary** of the interactive region, not underneath it.

Once something renders inside a React island it stays React: an `.astro`
component cannot be a child of a `.tsx` one.

### Rule 2 — Live data does not block the server

`/coding` renders on demand (`prerender = false`) because GitHub answers fast. `/music`
fetches its tracks from the browser instead, because an SSR request would block on a
cold start that outlasts the Vercel function timeout.

Do not "improve" this by moving `/music` to SSR.

### Rule 3 — One `.tsx` root per island

There are eight interactive roots, each mounted `client:load`:

| Root | Page |
| --- | --- |
| `MusicSection.tsx` | `/music` |
| `AdminUpload.tsx` | `/admin` |
| `ContactForm.tsx` | `/contact` |
| `ConvChain.tsx` | `/experimentation/convchain` |
| `HeatMap.tsx` | `/experimentation/heat-map` |
| `PigmentFlow.tsx` | `/experimentation/spectral` |
| `RecursiveSubdivision.tsx` | `/experimentation/subdivision` |
| `LoadingTracksLoop.tsx` | `/loading` |

Their children are React because of Rule 1, not because each needs its own
state. If you add another island, add it here too.

### Rule 4 — The API contract is generated, never transcribed

`src/types/index.ts` aliases the OpenAPI schema instead of restating the Java
DTOs. After changing a DTO or a controller signature, run `bun run gen:api` with
the API up. Details in `src/types/api/README.md`.

### Rule 5 — The server/client line is not negotiable

Astro frontmatter must never import browser controllers. Processed component
scripts may import them. Client bundles must never reach a server module.

| Module | Side | Why it matters |
| --- | --- | --- |
| `services/github.ts` | **server only** | reads `GITHUB_TOKEN`, runs during the render of `/coding` |
| `browser/shell/now-playing-element.ts` | **browser only** | `customElements.define`; no computed style on the server |
| `browser/shell/morphling-cursor.ts` | **browser only** | canvas, `requestAnimationFrame`, pointer events; a prerender has nothing to drive |
| `browser/` | **browser only** | DOM controllers, canvas painters and animation lifecycles |
| `lib/graphics/` | **server or client** | pure geometry, simulation and color |

An island's module body also runs while the page is being rendered on the
server. Read the theme through a `useRef` on first paint, never during render.

### Rule 6 — Comments explain why, or do not exist

A comment earns its place only when the code cannot say it. The test:

> If the comment would still be true after renaming the function to something
> accurate, it is restating the name. Cut it.

| Keep | Cut |
| --- | --- |
| a decision and its constraint | what a line of code does |
| a workaround, with the system it works around | a restatement of the function name |
| non-obvious arithmetic | `// loop over the items` |
| why something is deliberately dumb | a JSDoc `@param` that repeats the type |

Format, so the file stays skimmable:

- **One header block per file**, at the top, and only when the filename does not
  already say what the file is. State the invariant or the surprise, not an
  overview of the code below.
- **Inline comments** only for arithmetic, magic numbers, or a constraint a
  reader would otherwise break. Reference the constant by name.
- **`/** */` JSDoc** on exported functions only, and only when the signature is
  not self-explanatory.
- **No comment banners that describe a diff**, no commented-out code.

Two things already violate the one-header rule. `lib/graphics/sim/vents.ts` and
`lib/graphics/sim/layouts.ts` carry near-identical preambles opening with "the aesthetic
layer, deliberately kept out of the solver", and they are not two concerns that
happen to share a preamble — `vents.ts` is the abandoned earlier iteration of
the same module and `layouts.ts` replaced it. `vents.ts` is dead; see
[Dead code](#dead-code).

### Rule 7 — Loading paints before application content

`Layout.astro` sets `data-boot-pending` in an inline head script on every full
page load, including reloads in the same tab. CSS shows the server-rendered
partition and hides application content before the client bundle executes.
Without JavaScript the marker is absent and the page remains usable. A 6.5s
inline timeout removes the marker and overlay if the client bundle fails.

Boot and route loading share the Canvas 2D painter in `browser/loading/route-curtain.ts`.
It reads theme properties, draws at most 30fps, caps DPR at 2, stops in hidden
tabs, and holds its frame under reduced motion. Shared cuts move through the
partition engine; no WebGL download is required to animate loading.

Future WebGL scenes must load through dynamic imports after first paint and
register teardown through `createCleanupRegistry`. The old three.js splash
scene and its custom Vite chunk warning limit were removed when the loading
painter became 2D. `browser/audio/playback-canvas.ts` also remains 2D.

### Rule 8 — A partition draws its boundaries once, from the geometry

Anything that tiles a rectangle gets its cells from `lib/recursion/subdivide` and
its lines from `interiorEdges`. Cells never carry a border.

The theme curtain is an alpha mask rather than a geometric partition. Its regular
Bayer pixel grid lives in `browser/shell/theme-transition.ts`; it has no cell boundaries to draw.

A border on each cell draws every interior line twice, once from each side, so the
grid comes out at double weight inside and single weight at the frame. Worse, each
side lands on its own rounded pixel, so the two halves of one line do not land on
the same pixel: the grid is uneven in position as well as weight. One element per
boundary, driven by the same numbers as the fills, fixes both and cannot drift.

`Cell` is four edges rather than `x/y/w/h` for the same reason. `x = parent.x +
cut` and `w = parent.w - cut` write one boundary down twice, the two disagree in
the low bits, and a renderer snapping to the device pixel grid turns that into a
one-pixel seam. The cut is computed once and handed to both children.

Snapping happens twice, on purpose: `subdivide` snaps to a power-of-two lattice so
no drift accumulates, and the renderer snaps to whole device pixels so no edge falls
between two of them.

On `/experimentation/subdivision`, geometry updates atomically. A recut can change cut
directions and adjacency, so interpolating rectangles or grid lines independently produces
overlaps and gaps during the transition even when both endpoints tile exactly. Only
background colours transition. At a cut ratio of `0.5`, the algorithm always bisects the
longer side, giving a regular grid independent of seed, grain and bias. This is the page's
initial setting; lower ratios enable irregular partitions.

Loading passes a continuous `phase` to the same engine. Split directions are
chosen from the seed's reference boxes, while moving ratios rebuild each parent
and both children from one shared cut. This permits continuous motion without
interpolating unrelated leaf rectangles. Phase zero reproduces the static seed;
a cut ratio of `0.5` stays a regular grid at every phase.

### Rule 9 — Routes compose sections

Page templates own route metadata, rendering mode, response headers, server data
fetching and the order of their sections. Keep substantial section markup and its
local presentation data in named Astro components. Small route shells can mount
existing islands and shared headers directly without another wrapper component.

Do not put `<script>`, `<style>` or `style` attributes in `pages/`. Browser behavior
belongs to a browser module loaded by its owning component through a processed
`<script src="...">`. Stylesheets belong in `styles/` and are imported by the
component. Tailwind utilities remain appropriate for markup layout.

Data-driven inline styles are allowed inside components. `GithubProfile.astro`
sets calendar columns, weekday rows and cell colors from GitHub data; those values
cannot be represented by a fixed stylesheet. Its tooltip controller stays separate
from the pure SSR label and placement helpers in `lib/coding/contribution-tip.ts`.

The section extraction follows route boundaries: home biography, interests and
contact callout; coding introduction, experience, skills, contribution profile and
repositories; music introduction and catalog; experiment index; loading workbench.
Content, message references, IDs, section order and island hydration directives
stay with the extracted markup. GitHub requests and cache headers stay on `/coding`.
Validate the extraction with `bun run check` and `bun run build`.

## Dependency direction

Keep framework, browser and external-system code at explicit boundaries.

```text
pages/       -> layouts, components, services, lib, data, types
layouts/     -> components, styles
components/  -> components, hooks, browser, services, lib, data, types, styles
hooks/       -> hooks, services, lib, data, types
browser/     -> browser, services, lib, data, types, styles
services/    -> services, lib, data, types
lib/         -> lib, data, types
data/        -> data, types
types/       -> types
```

Astro frontmatter runs on the server. Import browser controllers only inside
processed component scripts. Layout scripts may initialize browser controllers;
layout frontmatter imports components and styles. React island modules also run
during SSR, so browser effects belong in effects or callbacks.

`lib/` contains framework-free calculations and transformations. It cannot import
React, hooks, services or browser controllers, or access browser globals. Storage,
locale state and visitor identity belong in `services/`; DOM localization belongs
in `browser/shell/`; the React locale subscription belongs in `hooks/`.
`services/github.ts` is server-only and must never be reachable from client code.
Playback has one singleton in `services/player.ts`, shared by React and the footer
custom element through their own adapters.

Use direct relative imports, without aliases or re-export barrels. Group large
layers by responsibility and keep small layers flat. Shared UI must not depend on
page-specific UI. Browser controllers may share painters across responsibilities,
such as the footer using the audio painters.

`bun run check:architecture` checks source imports, layer direction, browser globals
in production libraries, browser imports in Astro frontmatter, route composition
and client access to GitHub's server service. It runs inside `bun run check`.

## Where to go

The two questions that come up constantly.

### "Where does this behaviour live?"

| I am changing | Start here | Then |
| --- | --- | --- |
| what a page fetches | `pages/*.astro` frontmatter | `services/` for the transport |
| how the API is called | `services/api.ts` | `types/index.ts` for the shape |
| the site's own audio | `services/player.ts` | `browser/audio/playback-canvas.ts` to paint it |
| an embed (SoundCloud/Spotify) | `services/embed-players.ts` | `lib/audio/playback-ui.ts` for its labels |
| loading / error / retry UI | `hooks/useResource.ts` | `components/shared/ErrorNotice.tsx` |
| an optimistic mutation | `lib/optimistic.ts` | the caller's `apply`/`rollback` |
| a visual surface | `styles/global.css` `@utility` block | the call site for colour and layout |
| heading size | `styles/global.css` base heading scale | heading level (`h1`–`h6`), with `.hero-title` as the display exception |
| a colour choice | `lib/graphics/color-theory.ts` | never a raw hex in a scene |
| the splash | `browser/loading/` | `lib/loading/frame.ts` for the frame both renderers open on |
| navigation loading feedback | `browser/loading/route-curtain.ts` | `styles/loading/route-curtain.css` for the surfaces |
| the fluid / pigment page | `browser/experiments/` and `lib/graphics/sim/` | `lib/graphics/pigment-settings.ts` for the knobs |
| its zoom, pan or pointer | `lib/graphics/sim/camera.ts` | `PigmentFlow.tsx` for the drawImage |
| the subdivision page | `lib/graphics/recursion/subdivide.ts` | `components/experiments/RecursiveSubdivision.tsx` |
| browser resource teardown | `browser/shared/dispose.ts` | release resources from the owning controller |

### "How do I add a file?"

Ask which row of the diagram it belongs in, then place it there. If two answers
look equally right, the deciding question is **does it touch the DOM?** If yes it
is a component, a hook or a browser controller. External I/O and persistent state
belong in services. Pure calculations belong in `lib/`; editorial content and
domain transforms belong in `data/`.

When a directory outgrows its name, split the layer, not the convention —
[ADR-006](#adr-006-layer-over-subfolder).

## File index

Paths are relative to `src/frontend/src/`. Large layers group files by
responsibility. A component used by one area stays there; shared UI requires
actual reuse. Create no empty groups or re-export barrels.

### `pages/` — Routes

| File | Role |
| --- | --- |
| `admin.astro` | Unlisted upload console. |
| `coding.astro` | SSR GitHub requests, repository mapping, cache headers and coding sections. |
| `contact.astro` | Contact introduction and form island. |
| `experimentation/convchain.astro` | ConvChain sample-learning workbench and upstream credits. |
| `experimentation/heat-map.astro` | Bencho heat-map experiment header and HeatMap island. |
| `experimentation/index.astro` | Experiment index composition. |
| `experimentation/spectral.astro` | Experiment header and PigmentFlow island. |
| `experimentation/subdivision.astro` | Experiment header and RecursiveSubdivision island. |
| `index.astro` | Home composition. |
| `loading.astro` | Unlisted loading workbench. |
| `music.astro` | Prerendered introduction, browser catalog and editorial journey. |

### `layouts/` — Document shell

| File | Role |
| --- | --- |
| `Layout.astro` | html/head/body, mounts Navbar + BootScreen + Footer. Also the one place a page states how it is described and indexed: `description`, `noindex`, and the canonical/OG tags. |

### `components/` — Astro UI and React islands

| File | Role |
| --- | --- |
| `admin/AdminUpload.tsx` | `/admin` root. Key entry, song list, replace/delete. |
| `admin/UploadQueue.tsx` | The upload list and its controls. |
| `coding/CodingExperience.astro` | Employer, role and responsibilities. |
| `coding/CodingIntro.astro` | Coding heading and GitHub profile link. |
| `coding/CodingSkills.astro` | Coding skills and their local presentation data. |
| `coding/GithubProfile.astro` | Server-rendered contribution calendar and profile; loads the browser tooltip module. |
| `coding/PinnedRepositories.astro` | Pinned repository rows and unavailable state, receiving server-fetched repos. |
| `coding/RepoRow.astro` | One row in the `/coding` repos list. |
| `contact/ContactForm.tsx` | `/contact` form island with validation, stable retry references, and accessible delivery status. |
| `experiments/ConvChain.tsx` | ConvChain React root: editable 8×8 samples, model controls, time-budgeted generation, colors, tiling and PNG export. |
| `experiments/ExperimentCredits.astro` | Visible source, author and licence links for Spectral.js, Bencho and ConvChain, shared by the index and individual studies. |
| `experiments/controls.tsx` | The `Slider`/`Chips`/`Toggle`/`Panel` primitives both lab pages share. |
| `experiments/ExperimentHeader.astro` | Shared heading and back link for individual experiments. |
| `experiments/ExperimentIndex.astro` | Experiment index heading and study links. |
| `experiments/HeatMap.tsx` | Reusable React Canvas 2D heat map adapted from Bencho. Exports typed props, shapes and palettes; owns pointer/keyboard input and animation cleanup. |
| `experiments/PigmentControls.tsx` | The `/experimentation/spectral` panel. One slider per settings field. |
| `experiments/PigmentFlow.tsx` | `/experimentation/spectral` root. Owns settings, camera, persistence and controls; mounts the browser board controller. |
| `experiments/RecursiveSubdivision.tsx` | `/experimentation/subdivision` root. Pixel-snapped cells, grid layer, knobs. |
| `home/ContactCallout.astro` | Home contact invitation linking to `/contact`. |
| `home/FluidPanel.astro` | Home canvas; mounts and releases browser/experiments/fluid-panel.ts. |
| `home/Hero.astro` | `/` opening: the centered heading with a scrolling code fragment on the brutalist `code` plate and an FM wave on `soundwaves`. Nothing else; the ink band and the portrait belong to `HomeAbout.astro`. Language sizing is in `styles/home/hero.css`. |
| `home/HomeAbout.astro` | Home biography, background rows, portrait and fluid panel. |
| `home/HomeInterests.astro` | Home music interests, hobbies and creator links. |
| `loading/BootScreen.astro` | First-visit splash. In the layout, so one copy covers all routes. |
| `loading/LoadingTracks.tsx` | Cold-start skeleton driven by `ServerPulse`. |
| `loading/LoadingTracksLoop.tsx` | `/loading` island. Fake clock at 4x. |
| `loading/LoadingWorkbench.astro` | Loading replay UI, `LoadingTracksLoop` island and processed replay script. |
| `loading/RouteCurtain.astro` | Navigation loading overlay. In the layout, persisted across swaps. |
| `loading/ServerPulse.tsx` | One pulsing stage dot. |
| `music/AlbumCard.tsx` | The selected release embed and source link; its parent owns artwork, metadata and navigation. |
| `music/CommentThread.tsx` | Comments for one track, with optimistic edits. |
| `music/MusicCatalog.astro` | Catalog heading and the single `MusicSection` island. |
| `music/MusicIntro.astro` | Music introduction, catalog/journey anchors and platform links. |
| `music/MusicJourney.astro` | `/music` influence history using the complete artist-authored English and Spanish copy from `data/music-journey-copy.ts`. Early years and adolescence span both paths; later discoveries share time rows before converging in the full current-practice chapter. Mobile interleaves the same moments. Layout lives in `styles/music/music-journey.css`; SVG path lifecycle and geometry live in `browser/music/music-journey.ts`. Prose preserves the author's capitalization. Photos live in `public/images/influences`; `sources.json` and `credits.html` link to their source pages. |
| `music/MusicSection.tsx` | The single `/music` interactive catalog island. Loads releases and tracks independently into one keyed preview browser, with previous/next navigation and a selectable catalog. AlbumCard owns the one mounted release embed; PlayerBar and TrackBlock render the selected track. |
| `music/PlayerBar.tsx` | Selected-song transport and spectrum/waveform canvases; hides another song's progress and disables seeking until the selected song is active. |
| `music/StarRating.tsx` | Five-star input. |
| `music/TrackBlock.tsx` | Selected-track rating and comments; playback controls live in PlayerBar. |
| `shared/ErrorNotice.tsx` | Error display plus retry. |
| `shared/InvertLink.astro` | Inline text link that turns blue on hover and focus. For a name inside a heading. |
| `shared/LinkPreview.astro` | One outbound link inside running text, using the `text-highlight` plate, with its `note` shown as a popover on hover and keyboard focus. The note stays real text in the document, so assistive tech reads it and the localization pass translates it; only its placement is hover-only. Styling is in `styles/shared/link-preview.css`. |
| `shared/LocalizedText.astro` | Renders catalog-backed static copy from a semantic `MessageKey`, with English server output and client-side locale changes. |
| `shared/SocialButton.astro` | One outbound social link. |
| `shell/Footer.astro` | Compact contact footer, native shortcuts to the page's top and bottom, and the independently collapsible now-playing bar on every route. Shortcuts use a side rail on desktop and a labelled bottom dock on mobile; the audio bar sits above that dock. Contact links to `/contact` on every route except `/`, where the landing page has its own contact callout. Its hover fill starts at the pointer entry point. Only the player hides when idle; its fixed height sizes the spectrum. Styling is in `styles/shell/footer.css`; pointer and player behavior is in `browser/shell/footer.ts`. |
| `shell/LanguageSelector.astro` | Shared navbar language select; the square bordered surface lives in `styles/shell/language-selector.css`; the cursor target is the whole control. |
| `shell/MorphlingCursor.astro` | Persistent canvas overlay for the fine-pointer cursor treatment. |
| `shell/Navbar.astro` | Site navigation. |
| `shell/NowPlaying.astro` | Defines `<now-playing-el>`; the bridge to `browser/shell/now-playing-element.ts`. |

### `browser/` — Browser controllers and painters

| File | Role |
| --- | --- |
| `audio/playback-canvas.ts` | Browser spectrum and waveform painters; pure colors live in lib/audio/spectrum.ts. |
| `coding/contribution-calendar.ts` | Browser-only contribution tooltip binding across Astro navigation; hides and releases the old tooltip before swaps. |
| `experiments/conv-chain-canvas.ts` | Draws a binary ConvChain field with user-selected ink/paper and optional 2×2 tiling. |
| `experiments/fluid-filters.ts` | Browser grain and halftone canvas filters. |
| `experiments/fluid-panel.ts` | Home canvas controller, observers, animation and teardown. |
| `experiments/pigment-board.ts` | **Browser only.** Mounts one simulation, canvas layers, frame loop, resize observer and pointer listeners; exposes update/reset/dispose. |
| `loading/boot-controller.ts` | Every-load splash lifecycle, browser readiness, replay and bounded teardown. |
| `loading/replay.ts` | `/loading` replay schedule and repeat lifecycle. |
| `loading/route-curtain.ts` | Browser navigation overlay, loading painter, readiness and teardown. |
| `music/music-journey.ts` | Browser journey connector geometry, resize handling and teardown. |
| `shared/dispose.ts` | `createCleanupRegistry` and `frameBudget`. |
| `shell/footer.ts` | Footer contact hover origin, player toggle and persisted-route sync. |
| `shell/localization.ts` | DOM translations and accessible attributes across Astro navigation. |
| `shell/morphling-cursor.ts` | **Browser only.** Morphs local outline and center paths into an I-beam over editable fields or a tip-anchored arrow over ranges, sliders, and precision surfaces; caps other control outlines at 800 × 600 pixels. |
| `shell/now-playing-element.ts` | **Browser only.** The `<now-playing-el>` custom element. Flips `data-playing`, which is what shows the bar. |
| `shell/theme-transition.ts` | Browser-only Bayer cover/reveal canvas for explicit theme changes, with cancellation and reduced-motion fallback. |

### `hooks/` — React state and lifecycle

| File | Role |
| --- | --- |
| `useAlbums.ts` | Album list, mapped through `toAlbums`. |
| `usePlayer.ts` | Bridges the player singleton into React. |
| `useResource.ts` | Resource-scoped loading, cancellation and optimistic patches; only the current request may publish a result. |
| `useServerWarmup.ts` | Polls `/health` so the cold start can be narrated. |
| `useSongs.ts` | Track list plus the rating mutation. Also exports `applyVote`. |
| `useTranslations.ts` | React subscription to the locale service and typed translation functions. |
| `useUploadQueue.ts` | One batch coordinator with two upload workers; React state and network I/O around the pure queue model. |

### `services/` — I/O and shared state

| File | Role |
| --- | --- |
| `api.ts` | Typed client. Validates response envelopes, separates empty responses from required data, and shares decoding between fetch and XHR. |
| `embed-players.ts` | SoundCloud and Spotify widget transports. |
| `errors.ts` | Turns any thrown value into a user-facing message. |
| `github.ts` | Shapes returned by `services/github.ts`. |
| `locale.ts` | Shared, persisted browser locale for React islands and static pages. |
| `pigment-settings.ts` | Persist and restore pigment settings through storage and the pure settings validator. |
| `player.ts` | `PlayerEngine` singleton, waveform cache. |
| `storage.ts` | Guarded browser storage reads and writes, safe to import during SSR. |
| `visitor.ts` | Persistent visitor identity for ratings and comment ownership. |

### `lib/` — Pure logic

| File | Role |
| --- | --- |
| `audio/__tests__/playback-canvas.test.ts` | Checks spectrum color anchors, interpolation, silence and clipping. |
| `audio/playback-ui.ts` | Glyphs and clock formatting shared by three toggles. |
| `audio/spectrum.ts` | Pure dB-to-color interpolation for real and decorative spectra. |
| `coding/__tests__/contribution-tip.test.ts` | Contribution tip.test. |
| `coding/contribution-tip.ts` | Pure label and viewport placement for the `/coding` contribution hover tip. |
| `graphics/conv-chain.ts` | Framework-free ConvChain model learning and deterministic Metropolis sampler with cached toroidal pattern indices. |
| `graphics/__tests__/conv-chain.test.ts` | Checks learned counts, symmetry, epsilon, toroidal energy changes, deterministic batches and input boundaries. |
| `graphics/__tests__/fm-wave.test.ts` | Checks the FM frequency sweep, the wave cycle and the scroll direction. |
| `graphics/color-theory.ts` | OKLCh harmony palettes. |
| `graphics/fm-wave.ts` | Pure geometry and frequency calculation for the hero's modulated sine wave. |
| `graphics/paint-surface.ts` | Grid where overlapping pigment resolves into colour. |
| `graphics/pigment-math.ts` | Kubelka-Munk mixing and its cache. |
| `graphics/pigment-settings.ts` | Pure pigment settings, ranges, presets, validation and serialization. |
| `graphics/recursion/subdivide.ts` | The partition itself. Exact tiling, plus its boundary list. |
| `graphics/sim/camera.ts` | Zoom and pan as arithmetic on a normalised centre. |
| `graphics/sim/field-view.ts` | Speed and curl as an RGBA diagnostic layer. |
| `graphics/sim/fluid.ts` | Stable-fluids solver. No canvas, no DOM. |
| `graphics/sim/layouts.ts` | Emitter layouts. Aesthetic, not physics. |
| `graphics/sim/pigment-sim.ts` | Velocity + dye fields, layout, `PaintSurface`. |
| `graphics/sim/tracers.ts` | Points carried by the field, drawn as streaks. |
| `graphics/sim/vents.ts` | **Dead.** See [Dead code](#dead-code). |
| `i18n/catalog.ts` | Generated message references and locale tables derived from the English schema. |
| `i18n/de.ts` | German catalog implementation. |
| `i18n/en.ts` | English source schema and interpolation parameters. |
| `i18n/es.ts` | Spanish catalog implementation. |
| `i18n/fr.ts` | French catalog implementation. |
| `i18n/ja.ts` | Japanese catalog implementation. |
| `i18n/journey.ts` | Editorial translations derived from paired journey copy. |
| `i18n/translate.ts` | Typed catalog lookup and dynamic editorial translation lookup. |
| `i18n/types.ts` | Locale, catalog and interpolation types derived from English. |
| `music-journey-moments.ts` | Structural description of the journey's moments: lanes, artists, milestones and links. |
| `loading/frame.ts` | Pure shared splash geometry and server-rendered route curtain cells. |
| `loading/progress.ts` | Pure boot milestones and progress arithmetic. |
| `optimistic.ts` | `runOptimistic`: apply, commit, rollback, report. |
| `upload/audio-file.ts` | Upload validation mirrored from the server. |
| `upload/upload-queue.ts` | Pure upload states and transitions, including metadata failures and state-specific progress. |

### `data/` — Editorial content and transforms

| File | Role |
| --- | --- |
| `music-journey-copy.ts` | Complete artist-authored English and Spanish editorial copy. |
| `streaming-albums.ts` | Splits one API album into per-platform links; embed URLs and heights. |

### `types/` — Contracts and shared types

| File | Role |
| --- | --- |
| `api/README.md` | API contract generation and backend prerequisites. |
| `api/schema.ts` | Generated OpenAPI contract; regenerate with bun run gen:api. |
| `custom-elements.d.ts` | Declares `<now-playing-el>` for the template. |
| `github.ts` | Shapes returned by `services/github.ts`. |
| `index.ts` | Generated API aliases and shared client domain types. |
| `spectral.d.ts` | Declares the `spectral.js` module. |
| `streaming-embeds.d.ts` | Declares `SC.Widget` and the Spotify iframe API. |

### `styles/` — Presentation

| File | Role |
| --- | --- |
| `experiments/heat-map.css` | HeatMap canvas sizing, pointer interaction and keyboard focus; imported by the component. |
| `global.css` | Light/dark palette tokens, base layer, `@utility` surfaces including `text-highlight` for inline paragraph links, and native scroll entrance motion for static headings, paragraphs and figures. |
| `home/brut-word.css` | Hover plates and layered animations on the two highlighted hero words. |
| `home/hero.css` | Translated home heading sizing. |
| `loading/boot-screen.css` | First-paint splash visibility, static partition and canvas crossfade. |
| `loading/route-curtain.css` | Full-viewport partition, destination plate, exit fade and pending-link wash. |
| `loading/server-pulse.css` | `ServerPulse` animation. |
| `music/music-journey.css` | Music journey shell: container, intro, route key, path layout, moment grid, present section, credits and responsive breakpoints. |
| `music/music-journey-chapters.css` | Music journey chapter cards: bordered article, marker, lane label, prose, milestone, listening/video disclosure. |
| `music/music-journey-artists.css` | Music journey artist portrait grid and per-artist overrides. |
| `music/music-page.css` | Music intro, platform links and catalog layout; imported by the owning Astro sections. |
| `shared/brutal-button.css` | The `brut-up` hover reveal. |
| `shared/link-preview.css` | Link note popover presentation. |
| `shared/social-button.css` | `SocialButton` surfaces. |
| `shell/footer.css` | Shared footer, page shortcut dock, and mobile audio-player spacing. |
| `shell/language-selector.css` | `LanguageSelector` plate, select and chevron. Every part keeps `border-radius: 0`, because the native select chrome is rounded and must stay hidden. |
| `shell/morphling-cursor.css` | Canvas overlay and native cursor suppression only after initialization on fine pointers without reduced motion. |

### Verification tooling

Paths are relative to `src/frontend/`.

| File | Role |
| --- | --- |
| `scripts/architecture-check.mjs` | Import resolution, layer direction, pure-library browser globals, route composition and client/server separation. Included in check. |
| `scripts/reorganize-frontend.mjs` | One-time migration and import rewriting; completed migrations make no changes on rerun. |
| `scripts/i18n-source-copy.mjs` | Locale fields, parameters, generated references and Astro source-copy audit. |
| `scripts/refactor-check.mjs` | Browser harness for transport, resources, uploads, playback and canvas lifecycle. |
| `scripts/responsive-check.mjs` | Responsive, loading, theme, experiment, cursor and music checks. |
| `scripts/i18n-check.mjs` | Language switching, hydration and layout checks. |
| `scripts/sim-preview.mts` | Simulation contact sheets using pure graphics modules. |
| `scripts/recursion-preview.mts` | Partition contact sheets and geometry checks. |
| `scripts/png.ts` | Shared minimal preview PNG encoder. |

## Decisions

Each entry is a decision that cost something to reach. Keep the reasoning: a
future change that contradicts one of these should first say why the reasoning
no longer holds.

<a id="adr-001"></a>
### ADR-001 — Astro-first, React only at island boundaries

**Context.** Three of eight routes have no interactive state at all.
**Decision.** `.astro` by default; `.tsx` only where client state exists.
**Consequences.** `/` ships no `react-dom`. The cost is that React children
cannot be `.astro`, so an island's subtree is permanently React.

<a id="adr-002"></a>
### ADR-002 — `/music` fetches from the browser

**Context.** Render on Render reaches a 30-60s cold start; Vercel functions time
out before it.
**Decision.** `/music` is prerendered and the client fetches, so a dead API shows
a retryable error instead of a gateway timeout.
**Consequences.** The API URL is public. There is a visible loading state on the
first load that an SSR page would not need.

<a id="adr-003"></a>
### ADR-003 — The footer widget is a custom element, not React

**Context.** `Footer.astro` renders on every route, including `/`, which has no
island.
**Decision.** `<now-playing-el>` subscribes to the same store as `PlayerBar`.
**Consequences.** No `react-dom` on `/`. It can only use HTML and canvas, and it
must be browser-only.

The bar carries nothing but this widget, so it stays out of the document until a
source has something to report: the element sets `data-playing` and
`has-[now-playing-el[data-playing]]:flex` is what gives the footer a box. An
idle "nothing playing" plate would be a footer that is not about anything.

The bar's height is fixed and the spectrum square takes it (`h-full` with
`aspect-square`). Letting the square drive the height meant the footer grew with
the square on every viewport, and the bar had no height of its own to animate
from. One direction only: the bar decides, the widget fills it. The footer stays
64 CSS pixels tall at every breakpoint. Its widget uses 4px vertical padding so
the 44px transport target fits; the spectrum fills the remaining inner height.

The reveal is `animate-footer-rise`, declared in the `@theme` block with its
keyframes. It replays because the footer's `display` changes, so nothing
re-triggers it, and `motion-reduce:animate-none` holds it still for visitors who
asked for that.

Elapsed time is shown only for `tracks`. An embed reports no position, and a
clock stuck at `0:00` next to a moving title is a claim about a track the page
cannot see.

<a id="adr-004"></a>
### ADR-004 — `PlayerEngine` is a singleton, not a hook

**Context.** Two rendering systems must observe one playback state: the React
`PlayerBar` and the footer custom element.
**Decision.** A module-level class, bridged into React with
`useSyncExternalStore`.
**Consequences.** React context would force the footer to hydrate React on every
page, which is the cost the custom element exists to avoid.

<a id="adr-005"></a>
### ADR-005 — One playback source owns the widget at a time

**Context.** The site hosts its own audio *and* mounts SoundCloud and Spotify
iframes. Two audible sources behind one title is silent drift.
**Decision.** `PlayerState` splits into `nowPlaying` (what is audible, and the
only `title` any surface renders) and `track` (the audio element this engine
owns). Starting an embed pauses the site's own audio, and the reverse.

| Source | Title comes from | Transport | Spectrum |
| --- | --- | --- | --- |
| `tracks` | `SongResponse.title` | the audio element | real analyser data |
| `soundcloud` | `getCurrentSound().title` | `SC.Widget` | synthetic |
| `spotify` | `Album.title` | `EmbedController` | synthetic |

**Consequences.** An embed reports through a token from `attachExternal`, so a
message arriving after its iframe was unmounted is dropped. Spotify's name is the
release, not the track: its iframe API emits a `playingURI` and never a track
name, and the Web Playback SDK that does return names needs OAuth and Premium.

Each token maps to its own transport. The active embed stores its token and report
together, so mounting another embed cannot redirect the footer's controls. Source
ownership changes before pausing the previous source because platform callbacks
can arrive synchronously. Pauses from inactive tokens and reports from released
tokens are ignored. Native playback promises carry a generation so an obsolete
play request cannot publish its result after ownership changes. SoundCloud mounts
unbind their events and Spotify mounts destroy their controller on release.

<a id="adr-006"></a>
### ADR-006 — Layer over subfolder

**Context.** The original flat component directory held 24 files. Route-section
extraction expanded the listing, while `lib/` mixed algorithms, React hooks,
persistent state and browser controllers.

**Decision.** Keep layers and group large layers by concept. Components group
shell, shared UI, home, coding, music, contact, admin, loading and experiments.
Styles follow the same owners where styles exist. Browser controllers and painters
live in `browser/`. Pure graphics, audio, loading, upload, coding and translation
modules live in `lib/`. Small hooks, services, data and type layers stay flat except
for generated API contracts under `types/api/`.

**Alternatives.** A flat tree no longer makes ownership easy to find. Full feature
directories would distribute shared playback, localization, loading and graphics
infrastructure across features. Grouping within layers retains dependency direction.

**Consequences.** Extensions identify Astro versus React; subdirectories identify
ownership. Shared UI requires actual reuse. Direct imports replace translation
barrels. The footer and React player retain one playback singleton. Pure pigment
configuration is separate from persistence, and spectrum colors are separate from
browser painters. `check:architecture` guards boundaries in subsequent changes.

<a id="adr-007"></a>
### ADR-007 — Every full load starts with the splash

**Context.** The adaptive delay and session flag skipped loading on warm home
loads and reloads, revealing application content before its loading screen.

**Decision.** An inline head marker shows the static splash before application
content. The client controller starts immediately, waits for DOM, fonts, assets
and actual `astro:hydrate` signals, then ramps to 100 and removes the overlay.
The `load` listener belongs to `window`; already-completed signals are checked
before listeners are registered. API requests inside islands retain their own
loading UI and do not hold the splash.

**Consequences.** Loading also appears on warm loads and repeat visits. A short
minimum hold makes the sequence visible. The client has a 4s readiness deadline,
with bounded teardown, and the inline 6.5s fallback covers a missing bundle.
Page controls are inert until the splash leaves. `/loading` uses the same
controller with scripted milestones; leaving it cancels the replay and restart.

<a id="adr-008"></a>
### ADR-008 — The `Painter` boundary in the subdivision image

**Context.** Three draw modes over one net.
**Decision.** `Painter` has exactly three primitives — `clear`, `polygon`,
`polyline`, `dot`.
**Consequences.** A mode is a list of polylines and polygons, so all three can be
rendered by a software rasterizer and checked as pictures with no browser in the
loop. Adding a fourth primitive has to earn itself against that.

<a id="adr-009"></a>
### ADR-009 — Cells are edges, and the grid is a separate layer

**Context.** Both rectangle screens looked wrong in the same way. Cells did not
meet: a grid line sat beside a cell edge, sometimes by a pixel, and lines varied in
weight. On `/loading` the cause was obvious once looked for — the splash scattered
independent rectangles over a grid, and independent rectangles overlap, so their
outlines crossed each other and nothing lined up with anything.

**Decision.** One partition module, `lib/recursion/subdivide`, produces every
rectangle drawing on the site. Cells are four edges, a cut is computed once and
handed to both children, edges snap to a power-of-two lattice, and renderers snap
to whole device pixels. No cell carries a border; the lines come from
`interiorEdges` as their own layer.

**Consequences.** The splash lost its population model — nothing is born or dies
mid-beat, cells only recut and change colour — which is what let it share the
algorithm. It now opens on a fixed seed, because the CSS fallback and the WebGL
scene crossfade and have to agree on the first frame. `interiorEdges` merges
collinear runs, so a T-junction is one line rather than three. The cost is that
`subdivide` grew a lattice and a boundary collector, and the invariant that the
output tiles the board exactly is now load-bearing enough to be worth asserting.

<a id="adr-010"></a>
### ADR-010 — One settings object, and one range table behind it

**Context.** `/experimentation/spectral` had fifteen pieces of state and twenty-eight props, and was
asked for more: a direction, a camera, a pointer, tracers, an overlay, presets. At
that prop count each one is another argument, another effect that has to push its
value into the simulation, and nowhere to put a preset or a keyboard shortcut.

**Decision.** Every knob is one field of `PigmentSettings` in
`lib/graphics/pigment-settings.ts`, with its accepted range in `RANGES`. The panel renders
`SettingSlider` from that field name, `sanitize` clamps against the same table, and
presets are partial objects merged through it.

**Consequences.** Adding a knob is one line in the settings, one line in `RANGES` and
one line in the panel, and a slider can never offer a range the simulation would
reject. Values restored from `localStorage` are untrusted input, which is why
`sanitize` also rejects unknown enumerations: an unknown `layout` has no emitters to
call and the board would sit there doing nothing with nothing to report.

<a id="adr-011"></a>
### ADR-011 — The camera crops, and there is no brush

**Context.** Two requests that looked independent and are the same decision.

Zoom: resizing the simulation rebuilds its fields, so a zoom that also raised the
resolution would throw the picture away on every notch, and one that did not would
magnify cells the solver has already smoothed. Brush: the board ran a second
`PaintSurface` at device resolution above the fluid, and every stroke on it was
outside the simulation — a picture that could be painted over.

**Decision.** `lib/graphics/sim/camera.ts` is a pure crop: `zoom`, a normalised centre, the
source rect for `drawImage`, and the inverse mapping for the pointer. It never
reaches the solver. The brush layer, the `draw` mode, and `PaintSurface`'s
deposition primitives (`dab`, `splat`, `clear`) are gone; the class resolves
concentrations into colour and nothing else.

**Consequences.** Magnifying past about 4x on `medium` detail is interpolation, not
new information — the honest way to get more there is the `detail` control, which
does re-seat the grid and does throw the picture away once, deliberately. Removing
the brush also removed the only caller of `PaintSurface` at device resolution, so
the surface is now single-purpose. The page's own claim, that nothing on the canvas
is a stroke, became literally true.

<a id="adr-012"></a>
### ADR-012 — The routes are the sections

**Context.** `/` had the hero, three blocks of biography and the whole repos list,
and the navbar called that one page "coding". Two audiences with nothing in common
landed on the same URL, and the second one to arrive — someone looking for what you
have built — had to scroll past the biography to find it.

**Decision.** Four sections, four top-level routes, one per audience.

| Section | Route | Renders on |
| --- | --- | --- |
| me | `/` | build |
| coding | `/coding` | demand, because it reads GitHub |
| music | `/music` | build |
| experimentation | `/experimentation` | build, plus one child route per experiment |

An experiment is nested rather than kept beside the sections, because a sixth
top-level entry in the navbar would read as a sixth section. The list on
`/experimentation` belongs to `components/experiments/ExperimentIndex.astro`, so adding an experiment is one entry
plus one page.

**Consequences.** The GitHub fetch left `/`, which is now prerendered: the one route
that had no live data no longer pays for a function invocation. `services/github.ts`
gained a second query, and both share `requestGraphQL` because the token is
rate-limited and `/coding` asks twice per cold render. The old `/spectral` and
`/subdivision` URLs 301 from `redirects` in `astro.config.mjs`, so the adapter owns
them; a new section must be added there too, not only to the navbar.

Contact lives on `/`, not at the bottom of the repos list. It was never about the
repos, it just happened to sit under them.

Every skill lives on `/coding`, before the GitHub profile: languages, frameworks,
AI agents, editors, data and architecture tools, and art, design, and music tools.
`/` keeps the biography and the personal interests, because those are about the
person rather than the work. The Bicotex experience moved to `/coding` for the same
reason: it is professional evidence, and `/` is the introduction.

<a id="adr-013"></a>
### ADR-013 — Links use stable visual states

**Context.** The SVG glitch treatment made text harder to read on hover and added a
document-wide filter and event listeners for five links.

**Decision.** Use `editorial-link` for text calls to action, the `text-highlight`
plate for outbound links inside a paragraph, and `LinkPreview.astro` when that link
also has to explain itself. `SocialButton.astro` gives music platforms a visible
logo, platform name and account handle. A link that lives inside a heading is
`InvertLink.astro`.

**Consequences.** The link filter, timer, and wrapper component are gone. The
YouTube channels sit in the running text of the free-time paragraph rather than in
a separate list; their card presentation is gone, and each one explains itself in a
popover on hover and keyboard focus. Because the note is a text node rather than
markup, it is translated like any other copy instead of needing its own plumbing.
Music platforms use visible `SocialButton.astro` cards.

<a id="adr-014"></a>
### ADR-014 — Navigation starts with a persisted animated partition

**Context.** A 300ms reveal delay skipped loading on warm navigations. Releasing
at `astro:after-swap` exposed the destination before its scripts and islands
were ready. Independent rectangle interpolation also created gaps in the splash.

**Decision.** `astro:before-preparation` shows the overlay immediately and wraps
Astro's loader so the loading frame paints before fetching the destination.
The partition shares its engine and painter with boot loading, using 32 cells
at viewport scale. It persists across the document swap and remains visible
through `astro:page-load`, font readiness and island hydration. A minimum 600ms
hold and a 260ms exit fade keep warm navigations readable.

**Consequences.** Every route change, including returning home and history
navigation, shows loading first. Same-page hash jumps bypass it. Controls are
inert and scrolling is locked through the exit. Cancellation and overlapping
navigations use a generation id so stale callbacks cannot release a newer load.
A 15s deadline releases a stalled overlay. Timers, observers and animation
frames are stopped when the overlay leaves. Reduced motion keeps the partition
still and removes the exit fade.

### ADR-015 — Async work and browser resources have one owner

`useResource` scopes each loader to its fixed-length dependency list. Reloading
aborts the previous request and preserves the last value for that same scope.
Changing dependencies hides the old value immediately. Cleanup invalidates the
scope, so late responses and old optimistic patches cannot update another resource.
Loaders receive an `AbortSignal` and pass it to the API client.

`services/api.ts` parses JSON as unknown and validates the envelope before exposing
its data. Required-data calls reject malformed JSON, missing data, null data and
unexpected 204 responses. Only explicitly empty operations accept 204 or an empty
success envelope. DTO fields remain governed by the generated OpenAPI contract;
this transport check does not claim to validate every DTO field at runtime. The
contact receipt keeps its additional validation before clearing the draft.

`lib/upload/upload-queue.ts` owns pure state transitions. Only uploading rows have progress,
and only failed rows have a metadata or request failure. `useUploadQueue` reserves
rows synchronously and runs two workers under one batch promise. Successful batches
refresh the catalog once, even after a partial failure. Refresh errors release the
coordinator and remain visible. Unmounting stops queued work and ignores callbacks;
requests already sent may finish on the server, so they are not silently retried.

`PigmentFlow` owns editable settings and the camera. `sim/pigment-board.ts` keeps
the latest snapshot for its animation and reports gestures through plain callbacks.
Its update operation applies palette, flow, layout, tracer and detail changes to
the mounted simulation. Camera updates do not reseat the grid. Its idempotent
dispose operation releases the frame loop, resize observer and canvas input
listeners. The controller imports neither React nor services.

Run `bun run check:refactor` for the browser regression checks. The harness uses
actual fetch and XHR decoding, React mounts and Canvas 2D, with controlled network
responses and platform SDK fixtures. It requires no production API or SDK login.
Run `bun run check` and `bun run build` for the types and deployment output.

## Dead code

`lib/graphics/sim/vents.ts` remains the unreferenced predecessor of `layouts.ts`.
It is retained during this structural migration. The previously listed 3D viewer,
its cages, fit helper and subdivision scene are already absent from the source
tree; they are not valid extension points.

The duplicate `services/ServerPulse.tsx` was identical to the UI component and has
been removed. `components/loading/ServerPulse.tsx` owns that presentation. Both
translation barrels were removed after migrating consumers to direct imports.

## Known constraints

- **Spectral owns one simulation per mount.** Palette changes use `setPigments`
  so the grid size, flow settings and tracer configuration survive. Recreating
  the simulation on a palette change left it at 4x4 when the canvas dimensions
  had not changed. Drawing layers follow the simulation dimensions each frame,
  including detail changes that do not resize the visible canvas.

- **Cross-origin audio cannot be analysed.** A page can only route audio it
  fetches itself through the Web Audio API, so the analyser behind the spectrum
  square only ever sees tracks the site hosts. SoundCloud and Spotify report
  metadata and nothing more, which is why their title is a fallback and not a
  measurement.
  Spectrum colors use float analyser dB values rather than bytes, since byte
  values clip at the analyser's maximum and would merge -10 dB and 0 dB. Each
  bar interpolates white at -120 dB, light purple at -80 dB, light blue at
  -40 dB, salmon pink at -10 dB, and white at 0 dB. Silence is white; -120 dB
  is the finite interpolation endpoint for negative infinity. Bar heights
  retain the analyser's byte scaling and frequencies retain the logarithmic
  layout. Synthetic embed spectra reuse these colors from their decorative
  levels, mapped to -100 through -30 dB, without claiming measured audio.
  This content palette is independent of the interface theme colors.
- **Limited tests.** `bun scripts/recursion-preview.mts --check` verifies 5,600
  animated partitions across depths, seeds and phases. Other pure pieces (`applyVote`, `runOptimistic`, `playback-canvas`,
  `streaming-albums`, `errors`, `catmull-clark`, `pigment-math`, `pigment-settings`,
  `recursion/subdivide`, `sim/camera`, `sim/tracers`, `sim/field-view`) are already
  shaped for further coverage.
- **Zoom cannot invent detail.** `lib/graphics/sim/camera` crops, so past roughly 4x on
  `medium` the board is showing bilinear magnification of cells the solver has
  already smoothed. Raising `detail` re-seats the grid and is the only thing that
  adds information, and it restarts the picture. See
  [ADR-011](#adr-011--the-camera-crops-and-there-is-no-brush).
- **Metadata is one layout prop deep, not a per-page head.** `Layout.astro` emits
  the description, the canonical URL and the Open Graph tags from three props, so a
  page states what it is and nothing else. The origin comes from `site` in
  `astro.config.mjs` — canonical and `og:image` have to be absolute, so that one
  value is the only place the domain is written. `og:image` points at
  `public/images/previews/og.png`, which is a supplied asset, not a generated
  one; until it exists the link is a 404 and previews fall back to no image.
  `/admin` and `/loading` pass `noindex` and are filtered out of the sitemap,
  because a sitemap listing a noindex page asks for the opposite of the robots tag.
- **No linter.** `bun run check` is the only gate, and it must run before every
  commit, not only in CI.
- **The `/` about panel runs a solver behind its heading.** It is gated on
  `IntersectionObserver` and released on `astro:before-swap`. Reduced motion gets the
  settled frame. The solver stays at `112×132`; its output is scaled into the clipped
  panel with alpha and a six-cell edge fade. Gain is applied while composing those
  cells. Noise and halftone are a separate high-resolution layer: a small texture tile
  is created on resize, then composited with one `fillRect` per paint. Do not draw the
  dots individually per frame; that made the display layer dominate the solver cost.
  The grid is portrait because `drawImage` stretches it to the panel, and a band-shaped
  grid smears every plume vertically. The sources sit twenty cells below the bottom
  edge with a radius that spans the gap: `freeSlipBoundary` cancels velocity crossing
  each wall, so moving the centre out without growing the radius drops them out of the
  field entirely. They are placed on a golden-ratio sequence rather than evenly spaced,
  because evenly spaced reads as a printed pattern.
- **A steep display curve and an interactive field are mutually exclusive.** `density`
  is `1 - exp(-total * DENSITY)`, so raising `DENSITY` to rescue a faint picture pins
  most of the panel at full alpha — and a field with no headroom cannot show the
  pointer moving dye through it, because swapping saturated ink around renders
  identically. Visibility has to come from the dose (`DYE_PER_STEP`), not the curve.
  Keep the saturated fraction low; that number is the headroom the stir has.
- **Measure `dt` from the last step, not the last animation frame.** The sources inject
  per step and the damping is per second, so on a 120Hz display a `dt` taken from the
  previous rAF is a quarter of the step it is supposed to advance: the two drift apart
  and the panel silts up with dye over a minute. It looks correct in the first few
  seconds and then fills with colour, so it has to be caught by sampling the panel at
  two different ages rather than by looking once.
- **Forcing a source needs `drive`, not `setVelocity`.** `setVelocity` is a four-cell
  bilinear splat, so a handful of them cannot lift dye against velocity damping, and
  the failure is two round blobs with no filaments rather than an error.
- **No path aliases.** See [Dependency direction](#dependency-direction).
- **Upload limits are duplicated** between `lib/upload/audio-file.ts` and
  `FileStorageService.validate`. They are constants in two languages and the
  alternative is a round trip to find out.
- **Contact receipts are validated before clearing the draft.** The API boundary
  requires an `accepted` status and a nonempty `messageId`. An incomplete success
  response keeps the text and submission id available for a safe retry. Responsive
  checks exercise server errors, network failures, malformed receipts, and acceptance.
  Run `node scripts/responsive-check.mjs --contact` for the contact checks alone.

## Amending this document

When you change the code, ask three questions. If any answer is yes, this file
changes in the same commit.

1. **Did a file move, appear or disappear?** Update the
   [File index](#file-index) and the [Dead code](#dead-code) register.
2. **Did a rule change, or did a rule get broken deliberately?** Update
   [The rules](#the-rules), and record it as an ADR if it cost something.
3. **Did you learn why something is the way it is?** That reasoning is the most
   expensive thing in this repository to reconstruct and the easiest to lose.
   Put it next to the decision, not next to the code.

### Preserved presentation requirements

The interface uses cobalt blue (`#2448c8`), vermilion red (`#c6382b`), and
green (`#398653`), with warm paper (`#f3f1eb`), white, black, and neutral grays.
These are project colors, not historical Bauhaus color specifications. The
composition follows Bauhaus studies of color weight and contrast, documented
by [Getty](https://www.getty.edu/research/exhibitions_events/exhibitions/bauhaus/new_artist/form_color/color/).
Yellow stays excluded from the interface palette.

Blue leads navigation, buttons, and focus. Neutral surfaces occupy most of
each page; full color belongs to selected planes, not every heading or card.
The home background panel is paper, the Coding experience panel is red, the
Coding profile is blue, and the music browser uses neutral release/track headings
with a blue selected item. Green confirms delivery and completed uploads. Red also marks errors
and destructive actions; text and icons carry the status as well as color.

Social buttons preserve their platform brand colors, and the SoundCloud embed
keeps its orange accent. Artwork, external embeds, contribution data, and the
experiments' generated palettes remain content rather than theme tokens.

`brut-label` text is black. Labels on colored or black panels have white backing,
including numbered section labels. Blue and red surfaces use white text; green
status surfaces use black text. These foreground pairs exceed 4.5:1 contrast.

The home heading centers `i code & shrink soundwaves` across the full page width and
is the whole hero. The `01 / background` panel opens the about section with the
fluid ink band as a full-bleed backdrop, and the portrait sits under the heading.
There is one canvas per page: the band is mounted once per document, so a second
copy of `FluidPanel` on the same route would stay blank. `code` keeps its hover
plate. Hovering
`code` reveals a smaller, inverted source-code layer after the plate appears.
Each page load picks a fragment from the frontend or backend; its characters
rotate to 120 degrees and scroll down slowly. Hovering
`soundwaves` raises it with the same black extrusion, then fades in a red fill
clipped to an edge-to-edge frequency-modulated sine wave that scrolls to the
right, one word every 12 seconds. Its modulator still varies from 0.6 to 1.4
cycles across the word over a 32-second cycle, and it reaches the carrier as a sine:
straightening that sine into a phase ramp keeps the scroll but flattens the wave
into a slow detune, which `fm-wave.test.ts` pins by the curve repeating every half
box. The scroll is geometry, not CSS:
Chromium ignores `mask-size`, `mask-position` and `mask-repeat` on a mask
referenced with `url(#id)`, so the two masked boxes are twice the word and reach
left, the path samples the wave with an offset, and `clip-path` keeps the red
plate on the visible right half. Reaching left also keeps the page from gaining
horizontal scroll. Both masked boxes cover the same box so the white text and the
red fill never drift apart, and the path has to be continuous along its whole
width for the same reason. Elapsed time is never wrapped: the scroll has no
period, so a modulo on it would jump the wave every 32 seconds. The browser
updates the path at 30 frames per second
only while the word is hovered. The text is white on red and black above it. The
ampersand stays plain. The math
lives in `fm-wave.ts`, the interaction in `Hero.astro`, and the styling in
`brut-word.css`; the removed `BrutWords` wrapper is no longer needed for one heading.

The coding profile displays the daily contribution calendar, not only its total.
`services/github.ts` validates the calendar before caching it. Partial weeks keep
GitHub's weekday positions; narrow screens scroll the chart without widening the page.
Missing data shows a link to GitHub instead of fabricated contribution cells.
Hovering or tapping a cell shows GitHub's own wording for that day, so the label and
its placement live in `lib/coding/contribution-tip.ts` instead of in the page; the chart
declares `data-cursor="precision"` and the cursor morphs into the tip-anchored arrow
while it is under the pointer.

Music and experiment copy uses descriptive titles, short instructions, and factual
status messages. Remove rhetorical questions, slogans, and repeated explanations
of implementation details from these pages.

### Presentation and loading verification

The now-playing bar carries the transport, the elapsed time, the track name, the
track length, and the spectrum square, in that order. It is the whole footer, it
arrives when a source starts playing, and its height is fixed so the square fits
inside it instead of stretching the bar. The square is a phone-away decoration:
it stays hidden below `tablet`, where the bar has no room to spare.

Music loads albums and tracks independently. Track loading and errors stay in the
track group; they must not remove the release list, preview or platform controls.
The catalog precedes external platform links. An expanded album identifies the
embedded player source without claiming that playback has started.

Spectral keeps board, presets, color, and flow controls visible. Pointer, tracers,
surface diagnostics, view settings, and keyboard reference live in native
`details` under Advanced controls. Closing it does not reset any settings.
Numeric field labels separate camel-case words for display.

Subdivision starts automatic recuts only after checking reduced-motion preferences
in the browser. Enabling reduced motion pauses recuts; the visitor can explicitly
resume animation with the existing control.

Verify the home heading center against the main page bounds, not only its text
column. Hover checks must cover both words separately and leave the ampersand plain.

### Responsive presentation

The cursor morphs both its outline and colored center into an I-beam over text
fields and a tip-anchored arrow over sliders and `data-cursor="precision"`
surfaces. In the arrow the colored center keeps only the head: a full arrow inside
the outline reads as a second, smaller cursor. Precision mode persists through
dragging. The native cursor is hidden only when the canvas initializes, with native
fallbacks for reduced motion and coarse pointers. Run `node scripts/responsive-check.mjs --cursor` against the dev
server to verify rendered silhouettes, editing, dragging, and route persistence.

`LinkPreview` sets `data-cursor-region` on its hover target so the canvas outline
encloses both the link and its attached note as one rectangle. The note starts at
the link's lower edge. In panel mode the cursor fills that shape with an animated
subtle red-and-blue ordered dither driven by the cursor's wave field, then draws a
white outline. Red is sparse and translucent over the blue base; the texture renders
at 2x CSS resolution and updates at 24fps.
The link and note stay transparent above it, with white text. The note keeps a
CSS border and background when the custom cursor is unavailable.

Keep the hero, navigation, footer controls, form, and page grids usable from
320px through desktop widths. Long email addresses and media labels wrap or
truncate inside their panels; they do not widen the page. Touch targets and
focused controls remain easy to see and use.

Check the contact form at phone widths while editing and after delivery errors
and accepted receipts. Failed delivery keeps the draft for a safe retry.

## Experiment preview scrolling

Both experiment roots use `experiment-workspace` and `experiment-preview` in
`styles/global.css`. The preview sticks 0.5rem below the viewport top while the
page scrolls through controls. It is sized against the space below the navbar and
experiment heading so the full square is visible when it reaches its sticky
position. On phones it is also capped at 42svh to leave room for controls, with a
9rem floor for short landscape screens. Desktop keeps it beside the controls.
Ancestors must not introduce an overflow scroll container, which would change the
sticky containing block. The responsive check covers portrait, landscape and
desktop sizes; update the inset when the shared header changes.

Controller JSON methods return `ResponseFormat<?>`. OpenAPI response annotations
describe each data property so generated DTO types remain available. Audio range
responses retain `ResponseEntity<Resource>` to stream bytes and range headers.


## Light and dark themes

`Layout.astro` renders `data-theme="light"`. An inline head script accepts only
`light` or `dark` from `clm_theme` in local storage before first paint. A missing,
invalid, or inaccessible preference falls back to light regardless of OS settings.
The navbar toggle exposes its dark-mode state through `aria-pressed` and stays
hidden without JavaScript. Its delegated listener uses `services/storage.ts` for writes.
Astro swaps copy the current theme to the incoming document, including when storage
is unavailable. `astro:page-load` synchronizes each new toggle.

Explicit toggle clicks use `browser/shell/theme-transition.ts`: 180ms of Bayer coverage in
the current page background, followed by 240ms of pixel removal over the next
theme. The theme and saved preference change only when the mask is fully opaque.
The mask is decorative, ignores pointer events, and sits below the custom cursor
and navigation curtain. `aria-disabled` plus the click guard ignores repeated
requests while keeping keyboard focus. CSS color transitions are suppressed until
the mask is removed. Initial loads, reloads, and route swaps never start this effect.

One backing pixel represents at least six CSS pixels. Grid size grows on very
large viewports to keep the backing store near 100,000 pixels, independently of
device pixel ratio. The 8x8 Bayer ranks stay fixed throughout both phases, so there
is no random flicker and every cell is either opaque or transparent. This canvas
does not sample page content, images, frames, or experiment canvases.

Reduced motion, hidden documents, unavailable Canvas 2D, and loading overlays
apply the chosen theme immediately. Resize, visibility changes, pagehide, route
preparation, and a change in motion preferences finish an active effect, commit
the requested theme, remove its canvas, and release its listeners. A 1.5s deadline
also releases the curtain if animation frames stop. The before-swap handler
finishes any outstanding transition before copying the theme to the next document.

Use `styles/global.css` palette tokens for site UI. `brut-bg` is the page background,
`brut-surface` is a panel or input, `brut-subtle` and `brut-soft` are supporting
surfaces, `brut-black` is theme-dependent text and borders, and `brut-muted` is
secondary text. `brut-link` and `brut-danger` adjust text contrast per theme.
`brut-inverse` stays black and `brut-on-accent` stays white on colored or black
surfaces. Keep brand colors and experiment pigment palettes independent of the UI
theme. Add future UI color roles to both palettes here instead of hardcoding colors
in components. Loading partitions and the home fluid panel observe `data-theme`
and repaint their cached colors, including under reduced motion, with teardown
alongside their existing observers.

Run `node scripts/responsive-check.mjs --theme` against the dev server to check
rendered palettes, keyboard use, light defaults on dark OS settings, reload and
Astro navigation persistence, blocked storage, invalid preferences, mobile widths,
and the no-JavaScript fallback. `BASE_URL`, `BROWSER_PATH`, and `SCREENSHOT_DIR`
configure the server, browser executable, and optional captures.

After `bun run build`, run `node scripts/responsive-check.mjs --theme-motion`.
It serves the actual `dist/client` files through Playwright request interception,
so it needs no running server. The browser clock stops at intermediate frames to
verify binary alpha, full coverage at the swap, both directions, repeat-click
handling, focus, resize, reduced motion, navigation, reload, and canvas failure.
`SCREENSHOT_DIR` also saves both reveal frames for visual inspection.

## Language selection

The shared navbar includes the small `LanguageSelector.astro`, with a square,
44px touch target at every viewport and spacing from adjacent navigation cells.
English, Spanish, French, German and Japanese
are listed by their local names. `lib/i18n/en.ts` owns the English source schema;
the other locale modules implement it. The full music journey uses the artist's paired English and
Spanish text; its other locales fall back to English until supplied. No
translation service or dependency is used. Browser
language sets the first preference; `services/locale.ts` persists a visitor's
selection in local storage and React islands subscribe to the same locale.

`browser/shell/localization.ts` translates static Astro text and accessible labels,
updates the document language, and observes new static content after Astro
transitions. It deliberately skips hydrated React islands, user-entered text,
code samples and named GitHub repositories. Interactive interface labels use
`hooks/useTranslations.ts` inside the components, so React retains ownership of
its text and changing locale does not reset player, form or experiment state.
Static page copy must use `<LocalizedText id={messages.home.aboutTitle} />`
with a generated reference from `i18n/catalog.ts`; do not repeat the English
source value or write string message IDs in Astro markup. Accessible attributes
use generated references in matching `data-i18n-*` attributes. Page metadata must use the same
catalog source and update on locale changes. This keeps long paragraphs
independent of exact-text lookup and makes the catalog the single source of
truth. The music intro and its navigation labels follow this pattern. Run
`bun scripts/i18n-source-copy.mjs` to audit catalog keys, interpolation
parameters, handwritten message IDs in TypeScript/Astro and Astro literals that
duplicate catalog entries.
This read-only audit also runs as part of `bun run check`.

Each locale file groups messages into eleven named constants: common,
navigation, theme, loading, home, coding, contact, music, comments, experiments
and errors. `en` is a nested object such as `en.loading.status` and defines the
only source schema. `TranslationCatalog` derives every required section and
field from that object, widening English literal values to strings. Each other
locale implements that contract; `TranslationSection<"loading">` checks a section
and `satisfies TranslationCatalog` checks the complete object. Adding an English
field makes every incomplete locale fail type checking. Field names describe
purpose rather than the English sentence.

`messages` is generated from `en` with the same field structure. Components use
`messages.loading.status`; runtime lookup IDs are built from the section and
field automatically. Locale implementations repeat the required field names as
object members, without repeating dotted IDs. The internal flattened tables
belong to `catalog.ts`. Do not introduce a second manually maintained registry,
numeric message positions, or a fallback that hides missing locale fields.
Changing a schema field requires migrating all locale implementations and
consumers in the same change. The source-copy audit rejects handwritten lookup
IDs so future callers also use the generated references.

`MessageParams<Key>` extracts `{name}` placeholders from English literals using
template literal types. `translate`, the React translation hook and
`LocalizedText` require those named parameters and reject parameters on plain
labels. Use `PlainMessageKey` for components that accept only labels without
interpolation. `translateText` is the dynamic boundary for DOM content and
editorial copy; ordinary application calls use the typed `translate` API.
Changing wording still requires human translation review across all five locales;
matching keys and placeholders cannot establish equivalent meaning.
The artist-authored journey remains paired English and Spanish copy in
`data/music-journey-copy.ts`; French, German and Japanese use English for that
editorial body until translations are supplied. Do not rewrite its content while
changing its presentation or localization wiring. Unknown English copy stays in
English until the catalog receives a translation.
The responsive home heading reduces its type size for the longer Latin-script
translations. Keep the navigation routes unchanged when adding a locale.

`scripts/i18n-check.mjs` exercises all five languages across seven contact-form
viewports, preserves an in-progress form draft, reloads and switches Astro
routes, checks three viewport widths on the home, music and experiment pages,
verifies browser-language detection, and catches hydration errors and
horizontal overflow. Run it with `bun run check:i18n` after changes to the
selector, locale service, catalog or translated UI.

The shared social image is `public/images/previews/og.png`, a 1200 by 630 PNG.
Layout publishes it through Open Graph and Twitter tags with page descriptions.
Run `node scripts/responsive-check.mjs --experiments` to check the experiment
previews against `dist/client` through Playwright request interception.

### Music page composition

The route composes an introduction with a visible grid of platform links,
catalog, then the influence journey in document order. Native anchors reach the
catalog and journey without a horizontal scroll container or navigation handlers.
Layout owns the sole main
landmark. The catalog owns its outer boundary; its React children divide albums
from uploaded tracks and keep their loading, error and empty states independent.
A shared preview switches between release embeds and the selected track player.
The selected track owns its rating/comments panel; browsing never starts playback.
The catalog browser remains in MusicSection.tsx because only this island uses it. The editorial journey remains server-rendered. Its titles and paragraphs
come directly from the artist's complete paired English and Spanish versions in
`musicJourneyCopy`; the existing localization system handles language changes.
Keep both versions intact rather than regenerating one from the other. Shared
early chapters span both paths, the electronic scene and university chapters
sit alongside each other. When a later moment contains only a discovery, its
chapter spans both columns. Both threads continue behind the cards as a decorative
background, appearing in the gaps rather than occupying side gutters.
Wide chapters float the artist gallery to the right from 1024px so prose wraps
beside it and resumes the full width below it. A flow-root contains the float
inside each chapter; the gallery stays in normal scroll flow. Smaller screens
place the gallery between the chapter heading and its prose so references appear
before their explanation. Skrillex, Jacob Collier, Keith Jarrett and Ryuichi
Sakamoto receive larger portraits for their importance to the artist. Wide-card
galleries occupy at most 28% of the content width and stop at 16rem; the single-
portrait Jacob Collier and Keith Jarrett galleries expand to 34% and stop at 20rem.
Jacob's solo portrait stays square and Keith's uses a taller 4:5 crop. The five-
artist electronic gallery uses an asymmetrical tile layout, led by Mr. Bill, with
names overlaid on each photo; mobile reflows the same hierarchy into four columns.
Sakamoto keeps his existing photograph and spans the gallery width below a
single row of three supporting artists, avoiding an empty grid cell. Supporting
images use three columns, reducing to two below 480px; group photos use a wider crop.
The adolescent desktop gallery places Linkin Park across the top, Marshmello
and Post Malone in the middle, and Twenty One Pilots across the bottom. Its
16:9 crop is taller than Linkin Park's 2:1 crop. VOLTRA joins the electronic
discovery gallery. Supplied replacement references are stored locally and
recorded in the image manifest and credits without inheriting old license links.
Single portraits are capped at 42svh on mobile. `sources.json` is the authoritative
image manifest used by the component and links each local asset to its source;
`credits.html` exposes those sources. The current-practice
chapter converges both paths. The journey overrides the site's lowercase styling
to preserve the artist's capitalization and proper names. The current-practice
paragraphs use the full column width and justified alignment, with the last line
left at its natural width. Automatic hyphenation depends on the inherited document
language and the browser's available dictionaries; it may be unavailable.

Run `node scripts/responsive-check.mjs --music` against the dev server to check
anchors, section order, overflow and repeat visits through Astro navigation.

Journey connectors are two continuous cubic SVG paths behind opaque cards in an
isolated stacking context. Small border anchors identify each thread. The blue
path passes through actual electronic chapters, then holds its last horizontal
position through later discoveries; the red path follows discovery anchors.
Both end at the same present-day marker. Vertical curve tangents avoid diagonal
cuts between chapters. Theme-aware link/danger colors, 0.32 opacity, and strokes
of 2px on desktop or 1.5px on mobile keep the paths subordinate to the content.
`ResizeObserver` watches the journey, cards, period labels and present-day block.
Reflows are coalesced through one animation frame, including font loading and
locale changes. Scrolling does not recalculate geometry. Before a route swap,
the observer disconnects and any queued frame is cancelled; late font callbacks
cannot schedule work for the old page.

### Scroll entrance motion

`styles/global.css` uses native CSS view timelines for static `h2`, `h3`, `p`
and `figure` elements inside main. Each enters with 20px of vertical travel and
opacity rising from 0.45 to 1 during the first 80% of its entry range. Animation
applies to content, leaving structural panels and journey markers stationary so
borders and SVG paths remain aligned. There is no scroll listener or new library.
React island contents and experiment workspaces retain their own motion and
layout. Add `data-no-reveal` to a static element or its ancestor to opt out.
Reduced motion disables these effects, and browsers without view timelines show
the normal content immediately. No JavaScript initialization hides content.

### Page shortcuts

`Layout.astro` gives body the `page-top` anchor. `Footer.astro` provides the
`page-bottom` anchor and native links to both ends on every route. Desktop places
the shortcuts in the outer margin; mobile uses a labelled bottom dock and reserves
space in body so the contact footer remains reachable. The audio bar uses
`data-audio-player` to sit above this dock on mobile. Both anchor targets accept
focus for keyboard navigation. Shortcut labels use the shared translation catalog.
Native smooth scrolling applies only without a reduced-motion preference; no
scroll listener or JavaScript navigation state is required.





### Bencho heat map

`HeatMap.tsx` retains the supplied Bencho comments and fixed heat palettes under
the source MIT licence at https://bencho.dev/licence. This is a deliberate
exception to Rule 6's comment format: the original explanation of shadow blur,
field thresholds and palette arithmetic is part of the requested experiment.
These palettes represent experiment content, independent of interface theme tokens.
Inter is not fetched; the word uses the system fallback when Inter is absent.

The component needs no additional packages. Its stylesheet is imported directly;
its accessible labels use the existing translation hook in all five locales.
Use `<HeatMap client:load />` in Astro or `<HeatMap />` inside React. Props
`heat`, `soft` and `area` accept 0–100; `colors` selects Neon, Fire, Sea or Pop;
`shape` selects Dots, Asterisk or Word. Click, Enter and Space cycle shapes.
The loop sleeps at rest, cancels on cleanup and applies changes immediately
under reduced motion. Prop updates repaint without replaying the entrance.
`/experimentation/heat-map` provides the initial interactive preview.

### ConvChain and source credits

`/experimentation/convchain` adapts Maxim Gumin's ConvChain to an editable
Canvas 2D workbench. The pure engine in `lib/graphics/conv-chain.ts` learns
periodic N×N pattern weights from a square binary sample, optionally including
all eight rotations/reflections with their multiplicities. Unseen patterns retain
the upstream 0.1 weight. Random pixel proposals use the Metropolis rule with
log weights; cached indices update only the N² affected toroidal patterns.
A seeded PRNG makes output independent of animation batching. This is a port
of the algorithm, not a promise to reproduce .NET's random sequence.

The React root owns model parameters and animation lifetime; the browser painter
owns canvas pixels. No packages were added. The engine supports pattern sizes
2–4 and outputs up to 128×128; the UI caps output at 64×64 to keep the controls
responsive. Generation spends at most about 5ms per frame in batches of up to
128 proposals, with a separate sweeps-per-second control. It skips computation
in hidden documents, cancels frames on cleanup and starts paused under reduced
motion. Explicit Run remains available. A sweep is size² attempted flips, not
a visit to every pixel. Automatic generation stops at the iteration target; a
manual sweep can continue past it. Running after completion starts the seed again.

Editing the sample, pattern size, symmetries, output size or seed rebuilds the
model/field. Temperature, speed, target iterations, ink/paper and tile preview
continue from the current field. Reset restores the same seed and pauses; reroll
advances the seed. PNG export contains the current native-resolution canvas,
including the 2×2 repetition when enabled. All four editable 8×8 presets were
created for the site; no upstream sample images are copied. The upstream MIT
notice is retained in source and shipped as `public/convchain-LICENSE.txt`.

`ExperimentCredits.astro` credits Spectral.js by Ronald van Wijnen, Bencho's
Heat map and ConvChain by Maxim Gumin with project and licence links. The
experiment index lists all three; spectral/subdivision, heat-map and convchain
pages show their relevant source. Descriptions and controls use all five locales.

Verify the engine with `bun test src/lib/graphics/__tests__/conv-chain.test.ts`.
After `bun run build`, run `node scripts/conv-chain-check.mjs` with an optional
`BROWSER_PATH` to verify pixels, seeded reset/steps, editor changes, N=2–4,
resolution, automatic completion, tiles, PNG, locale switching and visible source
links on mobile and desktop. Screenshots go to ignored `dist/checks/`.

### Unified music preview

`MusicSection.tsx` owns one selection keyed by source and ID across curated
releases and uploaded tracks. The sidebar groups both sources and preserves their
independent loading, error and empty states. Previous/next buttons wrap through
the combined list; Left/Right work while focus is in that navigation. Incoming
API metadata and rating updates preserve selection by key rather than array index.
Catalog order remains curated, not a chronology claim.

Artwork and metadata render once above the shared preview. `AlbumCard` no longer
provides a second artwork/header or a collapse control. Exactly one release embed
is mounted at a time, with teardown on selection/platform changes. The preview
and catalog have bounded native scroll regions so long albums and lists remain
reachable without stretching the page. Mobile stacks the preview above the list;
choosing an item scrolls its preview into view when needed.

`PlayerBar` receives the preview song explicitly. If another song is playing,
the preview shows zero progress and cannot seek that other song. Only an explicit
Play starts the selected track. The shared player and footer keep owning existing
playback while the user browses. `TrackBlock` now owns selected-track feedback
only; its comments still load on demand. No API contract or backend changes.

After building, `node scripts/responsive-check.mjs --music-preview` verifies the
rendered catalog against API and embed fixtures at phone, tablet and desktop
widths: source selection, wrapping navigation, long titles/albums, no autoplay,
native audio playback, isolated seek state, lazy comments, independent source
failures and locale changes that preserve the mounted embed. Screenshots go to
ignored `dist/checks/`. Use `BROWSER_PATH` for an installed browser.
