import { existsSync, readFileSync, readdirSync, mkdirSync, renameSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = path.resolve(frontend, "../..");
const moves = new Map();
const group = (from, to, files) => {
  for (const file of files.split(" ")) moves.set(`src/${from}/${file}`, `src/${to}/${file}`);
};

group("components", "components/shell", "Navbar.astro Footer.astro LanguageSelector.astro MorphlingCursor.astro NowPlaying.astro");
group("components", "components/shared", "LocalizedText.astro LinkPreview.astro InvertLink.astro SocialButton.astro ErrorNotice.tsx");
group("components", "components/home", "Hero.astro HomeAbout.astro HomeInterests.astro ContactCallout.astro FluidPanel.astro");
group("components", "components/coding", "CodingIntro.astro CodingExperience.astro CodingSkills.astro GithubProfile.astro PinnedRepositories.astro RepoRow.astro");
group("components", "components/music", "MusicIntro.astro MusicCatalog.astro MusicSection.tsx MusicJourney.astro AlbumCard.tsx PlayerBar.tsx TrackBlock.tsx StarRating.tsx CommentThread.tsx");
group("components", "components/contact", "ContactForm.tsx");
group("components", "components/admin", "AdminUpload.tsx UploadQueue.tsx");
group("components", "components/loading", "BootScreen.astro RouteCurtain.astro LoadingWorkbench.astro LoadingTracksLoop.tsx LoadingTracks.tsx ServerPulse.tsx");
group("components", "components/experiments", "ExperimentHeader.astro ExperimentIndex.astro PigmentFlow.tsx PigmentControls.tsx RecursiveSubdivision.tsx controls.tsx");

group("lib", "browser/shell", "footer.ts morphling-cursor.ts theme-transition.ts now-playing-element.ts");
group("lib", "browser/loading", "route-curtain.ts");
group("lib/boot", "browser/loading", "boot-controller.ts replay.ts");
group("lib", "browser/coding", "contribution-calendar.ts");
group("lib", "browser/music", "music-journey.ts");
group("lib", "browser/audio", "playback-canvas.ts");
group("lib/sim", "browser/experiments", "fluid-panel.ts fluid-filters.ts pigment-board.ts");
group("lib/three", "browser/shared", "dispose.ts");
group("lib/i18n", "browser/shell", "browser.ts");
moves.set("src/lib/i18n/browser.ts", "src/browser/shell/localization.ts");
group("lib/i18n", "hooks", "useTranslations.ts");
group("lib/i18n", "services", "locale.ts");
group("lib", "services", "storage.ts visitor.ts");
group("lib", "lib/graphics", "color-theory.ts pigment-math.ts paint-surface.ts pigment-settings.ts fm-wave.ts");
group("lib/sim", "lib/graphics/sim", "fluid.ts camera.ts field-view.ts layouts.ts pigment-sim.ts tracers.ts vents.ts");
group("lib/recursion", "lib/graphics/recursion", "subdivide.ts");
group("lib/boot", "lib/loading", "frame.ts progress.ts");
group("lib", "lib/audio", "playback-ui.ts");
group("lib", "lib/upload", "audio-file.ts upload-queue.ts");
group("lib", "lib/coding", "contribution-tip.ts");
group("lib", "data", "music-journey-copy.ts");
group("lib/api", "types/api", "schema.ts README.md");
group("lib/__tests__", "lib/coding/__tests__", "contribution-tip.test.ts");
group("lib/__tests__", "lib/graphics/__tests__", "fm-wave.test.ts");
group("lib/__tests__", "lib/audio/__tests__", "playback-canvas.test.ts");

group("styles", "styles/shell", "footer.css language-selector.css morphling-cursor.css");
group("styles", "styles/home", "hero.css brut-word.css");
group("styles", "styles/music", "music-page.css music-journey.css");
group("styles", "styles/loading", "boot-screen.css route-curtain.css server-pulse.css");
group("styles", "styles/shared", "brutal-button.css social-button.css link-preview.css");

const absoluteMoves = new Map([...moves].map(([from, to]) => [path.join(frontend, from), path.join(frontend, to)]));
const normalize = value => value.replaceAll("\\", "/");
function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}

const pending = [...absoluteMoves].filter(([from]) => existsSync(from));
if (!pending.length && existsSync(path.join(frontend, "src/services/pigment-settings.ts")) && existsSync(path.join(frontend, "src/lib/audio/spectrum.ts"))) {
  console.log("Frontend layout already migrated.");
  process.exit(0);
}
for (const [from, to] of absoluteMoves) {
  if (!existsSync(from) && !existsSync(to)) throw new Error(`Missing migration source: ${from}`);
}
for (const [from, to] of pending) {
  for (const file of [from, to]) {
    const relative = path.relative(frontend, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Outside frontend: ${file}`);
  }
  if (existsSync(to)) throw new Error(`Destination already exists: ${to}`);
}

const sourceFiles = filesUnder(path.join(frontend, "src"));
const originalPaths = new Map([...absoluteMoves].map(([from, to]) => [to, from]));
const currentFiles = new Set([...sourceFiles, path.join(frontend, "src/services/pigment-settings.ts"), path.join(frontend, "src/lib/audio/spectrum.ts")]);
const originals = new Map(sourceFiles.map(file => {
  const original = originalPaths.get(file) ?? file;
  const text = readFileSync(file, "utf8").replace(/(["'])(\.{1,2}\/[^"'\r\n]+)\1/g, (match, quote, specifier) => {
    const base = path.resolve(path.dirname(file), specifier);
    const target = [base, ...[".ts", ".tsx", ".astro", ".json"].map(ext => base + ext)].find(candidate => currentFiles.has(candidate));
    if (!target) return match;
    let previous = originalPaths.get(target) ?? target;
    if (!path.extname(specifier)) previous = previous.slice(0, -path.extname(target).length);
    let relative = normalize(path.relative(path.dirname(original), previous));
    if (!relative.startsWith(".")) relative = "./" + relative;
    return quote + relative + quote;
  });
  return [original, text];
}));
const duplicate = path.join(frontend, "src/services/ServerPulse.tsx");
if (originals.has(duplicate) && originals.get(duplicate) !== originals.get(path.join(frontend, "src/components/ServerPulse.tsx"))) {
  throw new Error("ServerPulse copies differ; inspect before merging ownership.");
}

const custom = new Map();
const customize = (file, transform) => {
  const absolute = path.join(frontend, file);
  custom.set(absolute, transform(originals.get(absolute).replaceAll("\r\n", "\n")));
};
customize("src/components/MusicJourney.astro", text => text.replace('from "../lib/i18n"', 'from "../lib/music-journey-copy"'));
customize("src/components/LanguageSelector.astro", text => text.replace('from "../lib/i18n"', 'from "../lib/i18n/types"'));
customize("src/components/LocalizedText.astro", text => text.replace('from "../lib/i18n/index"', 'from "../lib/i18n/translate"'));
customize("src/lib/i18n/locale.ts", text => text.replace('from "./index"', 'from "./types"'));
customize("src/lib/i18n/browser.ts", text => text.replace('import { isLocale, translateText } from "./index";', 'import { isLocale } from "./types";\nimport { translateText } from "./translate";'));
customize("src/lib/i18n/useTranslations.ts", text => text.replace('from "./index"', 'from "./translate"'));
customize("src/lib/route-curtain.ts", text => text.replace('export const curtainCells = () => splashFrame(0, 0, 5);\n\n', ""));
customize("src/components/RouteCurtain.astro", text => text.replace('import { curtainCells } from "../lib/route-curtain";', 'import { curtainCells } from "../lib/boot/frame";'));
customize("src/lib/boot/frame.ts", text => text.includes("export const curtainCells") ? text : text + '\nexport const curtainCells = () => splashFrame(0, 0, 5);\n');

const settings = originals.get(path.join(frontend, "src/lib/pigment-settings.ts")).replaceAll("\r\n", "\n");
const storageKey = settings.match(/^const STORAGE_KEY = .*;$/m)?.[0];
if (!storageKey) throw new Error("Pigment storage key not found.");
const persistence = settings.slice(settings.indexOf("/** Restores the last session"), settings.indexOf("/** Snapshot for a preset"));
customize("src/lib/pigment-settings.ts", text => text.replace('import { readJson, writeJson } from "./storage";\n', "").replace(storageKey + "\n", "").replace(persistence, ""));
customize("src/components/PigmentFlow.tsx", text => text.replace("  rememberSettings,\n", "").replace("  restoreSettings,\n", "") + "\n");
if (!custom.get(path.join(frontend, "src/components/PigmentFlow.tsx")).includes("import { rememberSettings")) {
  custom.set(path.join(frontend, "src/components/PigmentFlow.tsx"), custom.get(path.join(frontend, "src/components/PigmentFlow.tsx")).replace('import PigmentControls from "./PigmentControls";', 'import PigmentControls from "./PigmentControls";\nimport { rememberSettings, restoreSettings } from "../services/pigment-settings";'));
}

const playback = originals.get(path.join(frontend, "src/lib/playback-canvas.ts")).replaceAll("\r\n", "\n");
const colorStart = playback.indexOf("const SPECTRUM_COLORS");
const colorEnd = playback.indexOf("/**", colorStart);
if (colorStart < 0 || colorEnd < 0) throw new Error("Spectrum color function not found.");
const spectrum = playback.slice(colorStart, colorEnd).replace("return UNPLAYED;", 'return "#ffffff";');
customize("src/lib/playback-canvas.ts", text => 'import { spectrumColor } from "./audio/spectrum";\n\n' + text.replace(playback.slice(colorStart, colorEnd), ""));
customize("src/lib/__tests__/playback-canvas.test.ts", text => text.replace('from "../playback-canvas"', 'from "../audio/spectrum"'));

originals.set(path.join(frontend, "src/services/pigment-settings.ts"), "");
originals.set(path.join(frontend, "src/lib/audio/spectrum.ts"), "");

const removed = new Set([duplicate, path.join(frontend, "src/lib/i18n.ts"), path.join(frontend, "src/lib/i18n/index.ts")]);
function resolveOriginal(importer, specifier) {
  const base = path.resolve(path.dirname(importer), specifier);
  return [base, ...[".ts", ".tsx", ".astro", ".mjs", ".mts", ".json"].map(ext => base + ext), path.join(base, "index.ts")]
    .find(candidate => originals.has(candidate) || existsSync(candidate));
}
function rewrite(importer, text) {
  const destination = absoluteMoves.get(importer) ?? importer;
  return text.replace(/(["'])(\.{1,2}\/[^"'\r\n]+)\1/g, (match, quote, specifier) => {
    const resolved = resolveOriginal(importer, specifier);
    if (!resolved) return match;
    if (removed.has(resolved)) throw new Error(`Legacy import remains: ${importer}: ${specifier}`);
    let target = absoluteMoves.get(resolved) ?? resolved;
    const extension = path.extname(resolved);
    if (!path.extname(specifier) && extension) target = target.slice(0, -extension.length);
    let relative = normalize(path.relative(path.dirname(destination), target));
    if (!relative.startsWith(".")) relative = "./" + relative;
    return quote + relative + quote;
  });
}

const writes = new Map();
for (const [file, text] of originals) {
  if (!removed.has(file)) writes.set(absoluteMoves.get(file) ?? file, rewrite(file, custom.get(file) ?? text));
}
for (const file of filesUnder(path.join(frontend, "scripts"))) {
  if (file === fileURLToPath(import.meta.url)) continue;
  let text = rewrite(file, readFileSync(file, "utf8"));
  for (const [from, to] of moves) text = text.replaceAll(from, to);
  text = text.replaceAll('"components/LocalizedText.astro"', '"components/shared/LocalizedText.astro"');
  writes.set(file, text);
}
writes.set(path.join(frontend, "src/services/pigment-settings.ts"), 'import { DEFAULT_SETTINGS, sanitize, type PigmentSettings } from "../lib/graphics/pigment-settings";\nimport { readJson, writeJson } from "./storage";\n\n' + storageKey + "\n\n" + persistence);
writes.set(path.join(frontend, "src/lib/audio/spectrum.ts"), spectrum);

for (const directory of ["docs", ".opencode/skills"]) {
  for (const file of filesUnder(path.join(repository, directory)).filter(file => file.endsWith(".md"))) {
    let text = readFileSync(file, "utf8");
    for (const [from, to] of moves) {
      text = text.replaceAll("src/frontend/" + from, "src/frontend/" + to);
      text = text.replaceAll(from.slice(4), to.slice(4));
    }
    writes.set(file, text);
  }
}
const packageFile = path.join(frontend, "package.json");
writes.set(packageFile, readFileSync(packageFile, "utf8").replaceAll("src/lib/api/schema.ts", "src/types/api/schema.ts"));

for (const [from, to] of pending) {
  mkdirSync(path.dirname(to), { recursive: true });
  renameSync(from, to);
}
for (const file of removed) if (existsSync(file)) unlinkSync(file);
for (const [file, text] of writes) {
  mkdirSync(path.dirname(file), { recursive: true });
  if (!existsSync(file) || readFileSync(file, "utf8") !== text) writeFileSync(file, text);
}
console.log(`Moved ${moves.size} files; updated imports, scripts and documented paths.`);
