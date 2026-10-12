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

The API parks between requests on free hosting, so its cold start can reach
30-60 seconds. That single fact drives every rendering decision below.

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

There are five interactive roots, each mounted `client:load`:

| Root | Page |
| --- | --- |
| `MusicSection.tsx` | `/music` |
| `AdminUpload.tsx` | `/admin` |
| `PigmentFlow.tsx` | `/experimentation/spectral` |
| `RecursiveSubdivision.tsx` | `/experimentation/subdivision` |
| `LoadingTracksLoop.tsx` | `/loading` |

Their children are React because of Rule 1, not because each needs its own
state. If you add a sixth island, add it here too.

### Rule 4 — The API contract is generated, never transcribed

`src/types/index.ts` aliases the OpenAPI schema instead of restating the Java
DTOs. After changing a DTO or a controller signature, run `bun run gen:api` with
the API up. Details in `src/lib/api/README.md`.

### Rule 5 — The server/client line is not negotiable

`.astro` must never import anything browser-only, and client bundles must never
reach a server module.

| Module | Side | Why it matters |
| --- | --- | --- |
| `services/github.ts` | **server only** | reads `GITHUB_TOKEN`, runs during the render of `/coding` |
| `lib/now-playing-element.ts` | **browser only** | `customElements.define`; no computed style on the server |
| `lib/morphling-cursor.ts` | **browser only** | canvas, `requestAnimationFrame`, pointer events; a prerender has nothing to drive |
| `lib/three/*`, `lib/sim/*` | **browser only** | canvas, WebGL, `requestAnimationFrame` |

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

Two things already violate the one-header rule. `lib/sim/vents.ts` and
`lib/sim/layouts.ts` carry near-identical preambles opening with "the aesthetic
layer, deliberately kept out of the solver", and they are not two concerns that
happen to share a preamble — `vents.ts` is the abandoned earlier iteration of
the same module and `layouts.ts` replaced it. `vents.ts` is dead; see
[Dead code](#dead-code).

### Rule 7 — Three.js is loaded by dynamic import, never awaited before first paint

The bundle is ~129 kB gzipped. Vite splits it into its own chunk, which
`lib/boot/boot-controller.ts` pulls in only after the splash is on screen.
`styles/boot-screen.css` ships a static composition that holds the frame until
the chunk lands, and stands in permanently under `prefers-reduced-motion` or
without WebGL.

Adding a scene must not put it in the entry chunk.

It is also the only chunk over Vite's default 500 kB warning, which is why
`build.chunkSizeWarningLimit` sits at 600. The number tracks this chunk, not a
taste: raise it only for a scene that is lazily imported the same way, and never
to quiet a chunk that is on the critical path.

Scenes read their palette from the `@theme` custom properties with
`getComputedStyle` rather than repeating hex values, so they follow
`global.css` instead of drifting from it.

Every scene registers its teardown through `createCleanupRegistry`, because a
scene that skips teardown keeps a render loop scheduled against a detached
canvas and never gives the tab's GPU memory back.

`lib/playback-canvas.ts` is 2D and stays that way: the spectrum and waveform are
cheap per-frame painters with no scene graph, and three.js would be a regression
there.

### Rule 8 — A partition draws its boundaries once, from the geometry

Anything that tiles a rectangle gets its cells from `lib/recursion/subdivide` and
its lines from `interiorEdges`. Cells never carry a border.

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

## Dependency direction

Imports point downward only. Nothing in a row may import from a row below it
being edited to reach something in a row above.

```
  pages/          routes; the only place server data fetching happens
     |            may import: layouts, components, services, lib, data, types
     v
  layouts/        document shell
     |            may import: components, styles
     v
  components/     .astro = server UI, .tsx = client island
     |            may import: hooks, services, lib, data, types
     v
  hooks/          client state and lifecycle
     |            may import: services, lib, data, types
     v
  services/       I/O and long-lived mutable state
     |            may import: lib, types
     v
  lib/            framework-free, no DOM assumptions beyond what the name claims
     |            may import: types
     v
  data/           pure domain transforms over API types
     |            may import: types
     v
  types/          generated contract aliases + client domain types
```

Two consequences worth stating, because breaking them is easy:

- `lib/` never imports `hooks/`, `services/` or `components/`. If a lib module
  needs one of them, it is not a lib module. `lib/now-playing-element.ts`
  currently reaches `services/player` and is the known exception: it is the
  bridge from the singleton to the DOM, and it is browser-only.
- `data/` is pure. No fetching, no storage, no timers. That is what makes
  `streaming-albums.ts` checkable by reading it.

There are **no path aliases**. Imports are relative, which is exactly why the
layers above are shallow. Adding aliases would let a deep import reach sideways
and silently break the direction above.

## Where to go

The two questions that come up constantly.

### "Where does this behaviour live?"

| I am changing | Start here | Then |
| --- | --- | --- |
| what a page fetches | `pages/*.astro` frontmatter | `services/` for the transport |
| how the API is called | `services/api.ts` | `types/index.ts` for the shape |
| the site's own audio | `services/player.ts` | `lib/playback-canvas.ts` to paint it |
| an embed (SoundCloud/Spotify) | `services/embed-players.ts` | `lib/playback-ui.ts` for its labels |
| loading / error / retry UI | `hooks/useResource.ts` | `components/ErrorNotice.tsx` |
| an optimistic mutation | `lib/optimistic.ts` | the caller's `apply`/`rollback` |
| a visual surface | `styles/global.css` `@utility` block | the call site for size and colour |
| a colour choice | `lib/color-theory.ts` | never a raw hex in a scene |
| the splash | `lib/boot/` | `lib/boot/frame.ts` for the frame both renderers open on |
| navigation loading feedback | `lib/route-curtain.ts` | `styles/route-curtain.css` for the surfaces |
| the fluid / pigment page | `lib/sim/` | `lib/pigment-settings.ts` for the knobs |
| its zoom, pan or pointer | `lib/sim/camera.ts` | `PigmentFlow.tsx` for the drawImage |
| the subdivision page | `lib/recursion/subdivide.ts` | `components/RecursiveSubdivision.tsx` |
| a WebGL scene | `lib/three/` | dynamic import it from a controller |

### "How do I add a file?"

Ask which row of the diagram it belongs in, then place it there. If two answers
look equally right, the deciding question is **does it touch the DOM?** If yes it
is a component, a hook or a service. If no it is `lib/` or `data/`.

When a directory outgrows its name, split the layer, not the convention —
[ADR-006](#adr-006-layer-over-subfolder).

## File index

One line per file. Read this before you move something.

### `src/pages/` — routes

The four sections are `/`, `/coding`, `/music` and `/experimentation`. See
[ADR-012](#adr-012--the-routes-are-the-sections).

| File | Role |
| --- | --- |
| `index.astro` | `/`. Profile, education, research, Bicotex experience, skills, interests, contact. Prerendered. |
| `coding.astro` | `/coding`. SSR, GitHub pinned repos + contribution count. |
| `music.astro` | `/music`. Static shell, mounts `MusicSection`. |
| `experimentation/index.astro` | `/experimentation`. Index of the experiments. |
| `experimentation/spectral.astro` | Static shell, mounts `PigmentFlow`. |
| `experimentation/subdivision.astro` | Static shell, mounts `RecursiveSubdivision`. |
| `admin.astro` | `/admin`. Static shell, mounts `AdminUpload`. |
| `loading.astro` | `/loading`. Dev workbench; nothing links to it. |

### `src/layouts/`

| File | Role |
| --- | --- |
| `Layout.astro` | html/head/body, mounts Navbar + BootScreen + Footer. |

### `src/components/` — `.astro`, server-rendered

| File | Role |
| --- | --- |
| `BootScreen.astro` | First-visit splash. In the layout, so one copy covers all routes. |
| `RouteCurtain.astro` | Navigation loading overlay. In the layout, persisted across swaps. |
| `Navbar.astro` | Site navigation. |
| `Footer.astro` | Footer shell; mounts `NowPlaying` once. |
| `Hero.astro` | `/` introduction, centered heading with separate brutalist hover plates on `code` and `sounds`, portrait, and route into the biography. |
| `ExperimentHeader.astro` | Shared heading and back link for individual experiments. |
| `RepoRow.astro` | One row in the `/coding` repos list. |
| `SocialButton.astro` | One outbound social link. |
| `NowPlaying.astro` | Defines `<now-playing-el>`; the bridge to `lib/now-playing-element.ts`. |
| `MorphlingCursor.astro` | Persistent canvas overlay for the fine-pointer cursor treatment. |

### `src/components/` — `.tsx`, inside an island

| File | Role |
| --- | --- |
| `MusicSection.tsx` | `/music` root. Composes PlayerBar, albums, tracks. |
| `AdminUpload.tsx` | `/admin` root. Key entry, song list, replace/delete. |
| `PigmentFlow.tsx` | `/experimentation/spectral` root. Canvas, camera, pointer, keys. |
| `PigmentControls.tsx` | The `/experimentation/spectral` panel. One slider per settings field. |
| `RecursiveSubdivision.tsx` | `/experimentation/subdivision` root. Pixel-snapped cells, grid layer, knobs. |
| `controls.tsx` | The `Slider`/`Chips`/`Toggle`/`Panel` primitives both lab pages share. |
| `LoadingTracksLoop.tsx` | `/loading` island. Fake clock at 4x. |
| `PlayerBar.tsx` | Transport + spectrum/waveform canvases. |
| `TrackBlock.tsx` | One track row: rating plus comments. |
| `AlbumCard.tsx` | One album plus its mounted embed. |
| `UploadQueue.tsx` | The upload list and its controls. |
| `LoadingTracks.tsx` | Cold-start skeleton driven by `ServerPulse`. |
| `ServerPulse.tsx` | One pulsing stage dot. |
| `StarRating.tsx` | Five-star input. |
| `CommentThread.tsx` | Comments for one track, with optimistic edits. |
| `ErrorNotice.tsx` | Error display plus retry. |
| `SubdivisionLab.tsx` | **Dead.** See [Dead code](#dead-code). |

### `src/hooks/`

| File | Role |
| --- | --- |
| `useResource.ts` | The `{data, loading, error, reload, setData}` lifecycle. |
| `useSongs.ts` | Track list plus the rating mutation. Also exports `applyVote`. |
| `useAlbums.ts` | Album list, mapped through `toAlbums`. |
| `useUploadQueue.ts` | Upload queue state machine. |
| `usePlayer.ts` | Bridges the player singleton into React. |
| `useServerWarmup.ts` | Polls `/health` so the cold start can be narrated. |

### `src/services/`

| File | Role |
| --- | --- |
| `api.ts` | Typed client. `fetch` for JSON, XHR for upload progress. |
| `errors.ts` | Turns any thrown value into a user-facing message. |
| `github.ts` | **Server only.** Pinned repos, validated daily contribution calendar, media images. |
| `player.ts` | `PlayerEngine` singleton, waveform cache. |
| `embed-players.ts` | SoundCloud and Spotify widget transports. |

### `src/lib/`

Framework-free unless the name says otherwise.

| File | Role |
| --- | --- |
| `storage.ts` | `localStorage` with the three guards every caller needs. |
| `visitor.ts` | Stable visitor id for rating and comment ownership. |
| `optimistic.ts` | `runOptimistic`: apply, commit, rollback, report. |
| `audio-file.ts` | Upload validation mirrored from the server. |
| `color-theory.ts` | OKLCh harmony palettes. |
| `pigment-math.ts` | Kubelka-Munk mixing and its cache. |
| `pigment-settings.ts` | Every knob on `/experimentation/spectral`, its ranges, presets, persistence. |
| `paint-surface.ts` | Grid where overlapping pigment resolves into colour. |
| `playback-canvas.ts` | 2D spectrum and waveform painters. |
| `playback-ui.ts` | Glyphs and clock formatting shared by three toggles. |
| `now-playing-element.ts` | **Browser only.** The `<now-playing-el>` custom element. |
| `morphling-cursor.ts` | **Browser only.** Morphs local shape points so the outline follows the pointer during transitions; caps control outlines at 450 × 300 pixels. |
| `route-curtain.ts` | **Browser only.** Adaptive-delay loading curtain for `ClientRouter` navigations. Also exports `curtainCells`. |
| `api/schema.ts` | Generated from `openapi.json`. Never hand-edited. |
| `api/README.md` | How and when to regenerate. |
| `boot/boot-controller.ts` | Splash lifecycle and the three.js dynamic import. |
| `boot/progress.ts` | Pure milestone arithmetic behind the percentage. |
| `boot/frame.ts` | The splash's opening partition, read by the CSS frame and the scene. |
| `recursion/subdivide.ts` | The partition itself. Exact tiling, plus its boundary list. |
| `sim/fluid.ts` | Stable-fluids solver. No canvas, no DOM. |
| `sim/pigment-sim.ts` | Velocity + dye fields, layout, `PaintSurface`. |
| `sim/layouts.ts` | Emitter layouts. Aesthetic, not physics. |
| `sim/camera.ts` | Zoom and pan as arithmetic on a normalised centre. |
| `sim/tracers.ts` | Points carried by the field, drawn as streaks. |
| `sim/field-view.ts` | Speed and curl as an RGBA diagnostic layer. |
| `sim/vents.ts` | **Dead.** See [Dead code](#dead-code). |
| `subdivision/catmull-clark.ts` | Pure geometry: positions in, positions out. |
| `subdivision/seeds.ts` | Seeded control nets. Never reads `Math.random`. |
| `subdivision/paint.ts` | Mesh to picture through a three-primitive `Painter`. |
| `subdivision/cages.ts` | **Dead.** See [Dead code](#dead-code). |
| `subdivision/fit.ts` | **Dead.** See [Dead code](#dead-code). |
| `three/dispose.ts` | `createCleanupRegistry` and `frameBudget`. |
| `three/splash-scene.ts` | The splash clock: the partition from `boot/frame`, recut per beat. |
| `three/subdivision-scene.ts` | **Dead.** See [Dead code](#dead-code). |

### `src/data/`

| File | Role |
| --- | --- |
| `streaming-albums.ts` | Splits one API album into per-platform links; embed URLs and heights. |

### `src/types/`

| File | Role |
| --- | --- |
| `index.ts` | Contract aliases plus client-side domain types. |
| `github.ts` | Shapes returned by `services/github.ts`. |
| `custom-elements.d.ts` | Declares `<now-playing-el>` for the template. |
| `streaming-embeds.d.ts` | Declares `SC.Widget` and the Spotify iframe API. |
| `spectral.d.ts` | Declares the `spectral.js` module. |

### `src/styles/`

| File | Role |
| --- | --- |
| `global.css` | Theme, base layer, and the `@utility` surfaces. |
| `brutal-button.css` | The `brut-up` hover reveal. |
| `boot-screen.css` | Static composition held until three.js lands. |
| `brut-word.css` | Hover plates and extruded shadows on the two highlighted hero words. |
| `server-pulse.css` | `ServerPulse` animation. |
| `social-button.css` | `SocialButton` surfaces. |
| `morphling-cursor.css` | Canvas overlay stacking and motion/accessibility fallbacks. |
| `route-curtain.css` | Curtain cells, the destination plate, and the pending-link wash. |

### Verification tooling — not shipped

| File | Role |
| --- | --- |
| `src/frontend/scripts/sim-preview.mts` | Renders the shipped simulation to a PNG contact sheet. |
| `src/frontend/scripts/recursion-preview.mts` | Renders partitions to a PNG contact sheet; `--check` verifies tiling, grid boundaries and exact regular grids. |
| `src/frontend/scripts/png.ts` | Minimal PNG encoder, so the above has no dependency. |

Both exist because every attempt to tune the simulation by statistics produced a
number that improved while the picture stayed broken. Judged by eye, not by
counters. `recursion-preview.mts` also draws the grid the way the page does, from
`interiorEdges` and once, so a regression in the drawing is visible in the sheet.

`sim-preview.mts` runs two sheets. The core one is 300×300 and costs about five
minutes; the layer one runs at half that resolution and costs about thirty seconds.
They are separate because every module in `lib/sim/` moves the fast sheet and none
of them move the slow one. Set `SIM_LAB_ONLY=1` to skip the core sheet while
iterating on relief, camera, tracers or heading.

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

<a id="adr-006"></a>
### ADR-006 — Layer over subfolder

**Context.** `components/` holds 24 files with two different execution models,
and `lib/` holds three unrelated graphics experiments.
**Decision.** The layer directory is the unit of ownership; a subfolder is added
only when one layer outgrows a flat listing. `components/*.astro` and
`components/*.tsx` stay flat, because the extension already says which model a
file runs under and a second path segment would only restate it.
**Consequences.** Subfolders that duplicate what the filename says are
rejected — see [Rule 6](#rule-6--comments-explain-why-or-do-not-exist) for the
same reasoning applied to comments. When a flat layer does outgrow itself, split
the *concept*, not the file type.

<a id="adr-007"></a>
### ADR-007 — The splash is `.astro` and gated by its own controller

**Context.** The splash appears on `/`, which has no island.
**Decision.** `BootScreen.astro` sits in the layout, server-rendered into every
response, and stays `display: none` until `boot-controller.ts` sets
`data-state="active"`. The same script that reveals it removes it.
**Consequences.** A bundle that fails to load cannot leave an overlay covering
the site forever. It shows once per tab (`sessionStorage`) and only when the
page is slow (adaptive delay). `boot/progress.ts` maps five real milestones onto
weights, with a creep term capped below 100 and a hard 4s deadline.

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
`lib/pigment-settings.ts`, with its accepted range in `RANGES`. The panel renders
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

**Decision.** `lib/sim/camera.ts` is a pure crop: `zoom`, a normalised centre, the
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
`/experimentation` is an array in the page, so adding an experiment is one entry
plus one page.

**Consequences.** The GitHub fetch left `/`, which is now prerendered: the one route
that had no live data no longer pays for a function invocation. `services/github.ts`
gained a second query, and both share `requestGraphQL` because the token is
rate-limited and `/coding` asks twice per cold render. The old `/spectral` and
`/subdivision` URLs 301 from `redirects` in `astro.config.mjs`, so the adapter owns
them; a new section must be added there too, not only to the navbar.

Contact lives on `/`, not at the bottom of the repos list. It was never about the
repos, it just happened to sit under them.

<a id="adr-013"></a>
### ADR-013 — Links use stable visual states

**Context.** The SVG glitch treatment made text harder to read on hover and added a
document-wide filter and event listeners for five links.

**Decision.** Use `editorial-link` for text calls to action and `channel-link`
for the YouTube channels. Each has a clear focus state and a color change. The
channels sit beside the paragraph that explains the interests they relate to.

**Consequences.** The link filter, timer, and wrapper component are gone. The
music platform links still use `SocialButton.astro`, where a compact row of
platform destinations helps people choose where to listen.

<a id="adr-014"></a>
### ADR-014 — Navigation feedback is two signals, not one overlay

**Context.** `ClientRouter` fetches the next document with nothing on screen to
say so. On a prerendered route off the cache that gap is short enough to read as
instant; on `/coding` (an SSR function with GitHub behind it) or `/music` (client
fetch against a cold Spring Boot) it runs to seconds and the site reads as hung.
The obvious fix — show a loading overlay on every click — makes the common case
worse, because most navigations finish in well under 100ms and a full-screen
overlay flashing for that long is more alarming than the silence it replaced.

**Decision.** Two signals at two different latencies.

| At | Signal | Why that latency |
| --- | --- | --- |
| 0ms | the clicked link washes `brut-yellow` | instant, and it points at what was asked for |
| 300ms | a partition curtain covers the viewport and names the destination | 300ms is where a wait stops reading as instant |

The curtain's cells are `splashFrame(0)`, the same partition the site opens
with, at viewport scale. Both read one function so they cannot drift into looking
like two different ideas.

**Consequences.** The overlay is `transition:persist`, because the half of it
that matters plays *after* the swap and would otherwise be destroyed by it.
Revealing is deferred by `requestAnimationFrame` so `clip-path` has a layout
value to transition from, and the exit is on a 320ms timeout rather than
`transitionend`, because a transition interrupted by a re-render never fires the
event that would have cleaned it up. `MAX_HOLD_MS` exists for the navigation the
router abandons without swapping; the overlay must never outlive the page it is
covering. The same-page hash jump is excluded — it fetches nothing, so a curtain
over an already-visible section is pure noise. Cells grow by `clip-path`, not
`transform: scale`, because a scale pulls each cell out of its own rectangle and
opens gaps along the shared edges mid-wipe — the same invariant as
[Rule 8](#rule-8--a-partition-draws-its-boundaries-once-from-the-geometry).

## Dead code

Dead files are a navigation hazard: they look like a place to make the change and
silently are not. This register exists so that "where do I go" has no wrong
answers.

| File | Size | Status |
| --- | --- | --- |
| `src/components/SubdivisionLab.tsx` | — | Unreferenced. The 3D cage viewer was replaced by `SubdivisionImage.tsx`. |
| `src/lib/subdivision/cages.ts` | 2.9 kB | Only `SubdivisionLab.tsx` imports it. |
| `src/lib/subdivision/fit.ts` | 1.9 kB | Only `SubdivisionLab.tsx` imports it. |
| `src/lib/three/subdivision-scene.ts` | 14 kB | Only `SubdivisionLab.tsx` imports it, dynamically. |
| `src/lib/sim/vents.ts` | 6.9 kB | Nothing imports it. The earlier iteration of `sim/layouts.ts`. |

Together these are about 26 kB across two abandoned features.

The first four are one 3D subdivision viewer with no route. The 2D path shares
only the vertex concepts.

`vents.ts` is a different kind of leftover: a rename where the old name was never
removed. `layouts.ts` is live and is what the spectral page uses.

**Decide before deleting.** Either delete the chain, or give it a route, or
record here why it stays unreferenced. An unlisted dead file is a bug in this
document.

Note that the three `lib/` subdivision files *are* referenced — by
`SubdivisionLab.tsx`. Describing them as "unreferenced" was wrong; they are
reachable only from code that nothing reaches.

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
- **Limited tests.** `bun scripts/recursion-preview.mts --check` verifies 1,120
  partitions across depths and seeds. Other pure pieces (`applyVote`, `runOptimistic`, `playback-canvas`,
  `streaming-albums`, `errors`, `catmull-clark`, `pigment-math`, `pigment-settings`,
  `recursion/subdivide`, `sim/camera`, `sim/tracers`, `sim/field-view`) are already
  shaped for further coverage.
- **Zoom cannot invent detail.** `lib/sim/camera` crops, so past roughly 4x on
  `medium` the board is showing bilinear magnification of cells the solver has
  already smoothed. Raising `detail` re-seats the grid and is the only thing that
  adds information, and it restarts the picture. See
  [ADR-011](#adr-011--the-camera-crops-and-there-is-no-brush).
- **No linter.** `bun run check` is the only gate, and it must run before every
  commit, not only in CI.
- **No path aliases.** See [Dependency direction](#dependency-direction).
- **Upload limits are duplicated** between `lib/audio-file.ts` and
  `FileStorageService.validate`. They are constants in two languages and the
  alternative is a round trip to find out.

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

The home heading centers `code & sounds` and applies the hover plate separately
only to `code` and `sounds`. The ampersand stays plain. The effect lives in
`brut-word.css`; the removed `BrutWords` wrapper is no longer needed for one heading.

The coding profile displays the daily contribution calendar, not only its total.
`services/github.ts` validates the calendar before caching it. Partial weeks keep
GitHub's weekday positions; narrow screens scroll the chart without widening the page.
Missing data shows a link to GitHub instead of fabricated contribution cells.

Music and experiment copy uses descriptive titles, short instructions, and factual
status messages. Remove rhetorical questions, slogans, and repeated explanations
of implementation details from these pages.
