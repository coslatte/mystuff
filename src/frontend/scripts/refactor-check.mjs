import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(join(tmpdir(), "cosmiclatte-refactor-"));
const modulePath = path => JSON.stringify(resolve(root, path).replaceAll("\\", "/"));
const entry = `
import { createElement } from ${modulePath("node_modules/react/index.js")};
import { createRoot } from ${modulePath("node_modules/react-dom/client.js")};
import { flushSync } from ${modulePath("node_modules/react-dom/index.js")};
import { api, ApiError } from ${modulePath("src/services/api.ts")};
import { useResource } from ${modulePath("src/hooks/useResource.ts")};
import { useUploadQueue } from ${modulePath("src/hooks/useUploadQueue.ts")};
import AdminUpload from ${modulePath("src/components/admin/AdminUpload.tsx")};
import { editUploadMetadata, transitionUpload } from ${modulePath("src/lib/upload/upload-queue.ts")};
import { player } from ${modulePath("src/services/player.ts")};
import { mountSoundCloud, mountSpotify } from ${modulePath("src/services/embed-players.ts")};
import { mountPigmentBoard } from ${modulePath("src/browser/experiments/pigment-board.ts")};
import { DEFAULT_SETTINGS } from ${modulePath("src/lib/graphics/pigment-settings.ts")};
import { makePigment } from ${modulePath("src/lib/graphics/pigment-math.ts")};
import { colorFor } from ${modulePath("src/lib/graphics/color-theory.ts")};
import { createCamera } from ${modulePath("src/lib/graphics/sim/camera.ts")};

const check = (condition, message) => { if (!condition) throw new Error(message); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(predicate, message) {
  const deadline = performance.now() + 5000;
  while (!predicate()) {
    check(performance.now() < deadline, message);
    await tick();
  }
}
async function rejects(operation, predicate, message) {
  try { await operation(); } catch (error) { check(predicate(error), message); return; }
  throw new Error(message);
}
function mount(Component, props) {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  const render = next => flushSync(() => root.render(createElement(Component, next)));
  render(props);
  let disposed = false;
  return { element, render, dispose() { if (!disposed) { disposed = true; flushSync(() => root.unmount()); element.remove(); } } };
}
const song = { id: 1, title: "First", artist: "Artist", duration: "4:00", audioUrl: location.origin + "/one.wav" };

async function checkTransport() {
  const original = window.fetch;
  try {
    window.fetch = async () => new Response(JSON.stringify({ success: true, data: [song] }));
    check((await api.getSongs())[0].id === 1, "Valid API payload");
    for (const body of ["{", "[]", "{}", '{"success":false,"data":[]}', '{"success":true}', '{"success":true,"data":null}']) {
      window.fetch = async () => new Response(body);
      await rejects(() => api.getSongs(), error => error instanceof ApiError, "Malformed success must reject: " + body);
    }
    window.fetch = async () => new Response(null, { status: 204 });
    check(await api.deleteSong(1, "key") === undefined, "DELETE accepts 204");
    await rejects(() => api.getSongs(), error => error instanceof ApiError, "A data read rejects 204");
    window.fetch = async () => new Response(JSON.stringify({ success: true, data: null }));
    await api.deleteSong(1, "key");
    window.fetch = async () => new Response("upstream unavailable", { status: 503, headers: { "X-Error-Id": "reference" } });
    await rejects(() => api.getSongs(), error => error.status === 503 && error.errorId === "reference", "Malformed error preserves HTTP diagnostics");
    window.fetch = async (_url, init) => {
      check(init.headers instanceof Headers && init.headers.get("X-Edit-Token") === "token", "Edit token stays in a header");
      return new Response(JSON.stringify({ success: true, data: {} }));
    };
    await api.updateComment(1, "edited", { editToken: "token" });
  } finally { window.fetch = original; }
  const form = new FormData();
  form.append("file", new File(["wave"], "sample.wav", { type: "audio/wav" }));
  check((await api.uploadSong(form, "key")).id === 1, "Real XHR accepts a valid envelope");
  await rejects(() => api.replaceSongAudio(1, form, "key"), error => error instanceof ApiError, "Real XHR rejects empty success");
  await rejects(() => api.uploadSong(form, "key", undefined, AbortSignal.abort()), error => error.status === 0, "Already aborted upload never starts");
}

async function checkResources() {
  const pending = [];
  let resource;
  function Probe({ id }) {
    resource = useResource(signal => new Promise((resolve, reject) => pending.push({ id, signal, resolve, reject })), [id]);
    return createElement("output", null, resource.data ?? "pending");
  }
  const view = mount(Probe, { id: "a" });
  try {
    await until(() => pending.length === 1, "Initial resource request");
    const initialReload = resource.reload;
    resource.reload();
    await until(() => pending.length === 2, "Overlapping request");
    check(pending[0].signal.aborted, "Reload aborts its predecessor");
    pending[1].resolve("fresh");
    await until(() => resource.data === "fresh", "Latest data renders");
    pending[0].reject(new Error("late failure"));
    await tick();
    check(resource.data === "fresh" && resource.error === null && !resource.loading, "Late failure cannot overwrite success");
    resource.reload();
    await until(() => pending.length === 3 && resource.loading, "Refresh starts");
    check(resource.data === "fresh", "Refresh keeps the same resource's data");
    const oldPatch = resource.setData;
    view.render({ id: "b" });
    await until(() => pending.length === 4, "New resource starts");
    check(resource.data === undefined && pending[2].signal.aborted, "A new key clears data and cancels the old read");
    oldPatch(() => "wrong key");
    await initialReload();
    check(pending.length === 4, "An obsolete reload cannot start work");
    pending[2].resolve("stale a");
    await tick();
    check(resource.data === undefined && resource.loading, "Late success cannot finish the new key's loading state");
    pending[3].resolve("b value");
    await until(() => resource.data === "b value", "New key resolves");
    resource.reload();
    await until(() => pending.length === 5, "Pending request before unmount");
    const reload = resource.reload;
    view.dispose();
    check(pending[4].signal.aborted, "Unmount aborts the active request");
    pending[4].resolve("after unmount");
    await reload();
    check(pending.length === 5, "Unmounted resource cannot reload");
  } finally { view.dispose(); }
}

async function checkQueue() {
  const file = new File(["wave"], "sample.wav", { type: "audio/wav" });
  const queued = { id: "model", file, title: "Title", artist: "", status: "queued" };
  const blocked = transitionUpload(queued, { type: "start" });
  check(blocked.status === "failed" && blocked.failure.kind === "metadata", "Missing metadata blocks an upload");
  check(editUploadMetadata(blocked, { artist: "Artist" }).status === "queued", "Fixing metadata requeues");
  check(transitionUpload(queued, { type: "progress", percent: 90 }) === queued, "Progress cannot start a queued row");
  const original = api.uploadSong;
  const jobs = [];
  let active = 0, maximum = 0, refreshed = 0, queue;
  let failRefresh = false;
  api.uploadSong = (form, key, progress) => new Promise((resolve, reject) => {
    active++;
    maximum = Math.max(maximum, active);
    jobs.push({ form, key, progress, resolve(value) { active--; resolve(value); }, reject(error) { active--; reject(error); } });
  });
  function Probe() {
    queue = useUploadQueue("key", async () => { refreshed++; if (failRefresh) throw new Error("refresh failed"); });
    return null;
  }
  const view = mount(Probe, {});
  try {
    await tick();
    queue.addFiles([file, file, file, file], "Artist");
    queue.start(); queue.start();
    check(jobs.length === 2 && maximum === 2, "One start fills exactly two slots; repeated start is idempotent");
    jobs[0].progress({ percent: null });
    await until(() => queue.items[0]?.status === "uploading" && queue.items[0].percent === null, "Indeterminate upload progress");
    jobs[0].reject(new ApiError("Try again", 503));
    jobs[1].resolve(song);
    await until(() => jobs.length === 4, "Workers refill both slots");
    jobs[2].resolve(song); jobs[3].resolve(song);
    await until(() => refreshed === 1 && queue.done === 3 && queue.failed === 1, "One refresh after a partially successful batch");
    await tick();
    queue.start();
    await tick(); await tick();
    check(refreshed === 1, "Historical completed rows do not refresh an empty batch");
    queue.retry(queue.items.find(item => item.status === "failed").id);
    await until(() => jobs.length === 5, "Individual retry starts");
    jobs[4].resolve(song);
    await until(() => refreshed === 2 && queue.done === 4, "Retry batch refreshes once");
    await tick();
    queue.addFiles([file], ""); queue.start();
    await until(() => queue.items.some(item => item.status === "failed" && item.failure.kind === "metadata"), "Metadata failure makes no request");
    check(jobs.length === 5, "Metadata failure consumes no network slot");
    const blockedId = queue.items.find(item => item.status === "failed").id;
    queue.setMeta(blockedId, { artist: "Fixed" });
    await tick();
    failRefresh = true;
    queue.start();
    await until(() => jobs.length === 6, "Corrected row starts");
    jobs[5].resolve(song);
    await until(() => queue.error instanceof Error, "Refresh failure is reported");
    failRefresh = false;
    queue.addFiles([file, file, file], "Artist"); queue.start();
    await until(() => jobs.length === 8, "A failed refresh releases the batch coordinator");
    const beforeUnmount = refreshed;
    view.dispose();
    jobs[6].resolve(song); jobs[7].resolve(song);
    await tick(); await tick();
    check(jobs.length === 8 && refreshed === beforeUnmount, "Unmount finishes in-flight requests without starting queued work or refreshing");
    check(maximum === 2, "Concurrency never exceeds two");
  } finally { view.dispose(); api.uploadSong = original; }
}

async function checkPlayback() {
  const NativeAudio = window.Audio;
  const NativeContext = window.AudioContext;
  let audio;
  class FakeAudio extends EventTarget {
    paused = true; src = ""; currentTime = 0; duration = 240;
    constructor() { super(); audio = this; }
    load() { this.paused = true; }
    play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
    pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
  }
  window.Audio = FakeAudio;
  window.AudioContext = undefined;
  const calls = { a: 0, b: 0, pausedA: 0, pausedB: 0 };
  const report = (title, isPlaying) => ({ key: title, title, source: "soundcloud", controllable: true, isPlaying });
  const a = player.attachExternal({ toggle() { calls.a++; }, pause() { calls.pausedA++; player.reportExternal(a, report("A", false)); } });
  const b = player.attachExternal({ toggle() { calls.b++; }, pause() { calls.pausedB++; player.reportExternal(b, report("B", false)); } });
  try {
    player.reportExternal(a, report("A", true)); player.toggle();
    check(calls.a === 1 && calls.b === 0, "Controls follow the playing embed, not the last mounted one");
    player.reportExternal(a, report("A", false)); player.toggle();
    check(calls.a === 2, "Paused external source can resume from the footer");
    player.reportExternal(b, report("B", true));
    check(calls.pausedA === 1 && player.getSnapshot().nowPlaying.title === "B", "Embed transfer pauses the previous source without stale pause stealing ownership");
    player.releaseExternal(a);
    check(player.getSnapshot().nowPlaying.title === "B", "Releasing an inactive embed preserves the active source");
    player.playSong(song); await tick();
    check(audio.paused === false && calls.pausedB === 1, "Own track pauses the active embed");
    player.reportExternal(b, report("B", false));
    check(player.getSnapshot().nowPlaying.source === "tracks", "Late pause cannot reclaim ownership");
    player.reportExternal(b, report("B", true));
    check(audio.paused && !player.getSnapshot().track.isPlaying, "Starting an embed pauses native audio");
    let rejectPlay;
    const normalPlay = audio.play;
    audio.play = () => new Promise((_resolve, reject) => { rejectPlay = reject; });
    player.playSong(song);
    player.reportExternal(b, report("B", true));
    rejectPlay(new Error("obsolete play failure"));
    await tick();
    check(!player.getSnapshot().track.error && player.getSnapshot().nowPlaying.title === "B", "Obsolete native play promises cannot publish after ownership changes");
    audio.play = normalPlay;
    player.releaseExternal(b); player.reportExternal(b, report("B", true));
    check(player.getSnapshot().nowPlaying.source === "tracks", "Released tokens cannot resurrect embeds");
    player.playSong(song); await tick();
    player.toggle({ ...song, id: 2, title: "Second", audioUrl: location.origin + "/two.wav" }); await tick();
    check(player.getSnapshot().track.song.id === 2 && !audio.paused, "Selecting another track while playing starts that track");
  } finally {
    player.releaseExternal(a); player.releaseExternal(b); audio?.pause();
    window.Audio = NativeAudio; window.AudioContext = NativeContext;
  }

  const callbacks = {};
  let unbound = 0, destroyed = 0, soundCallback;
  const widget = { toggle() {}, pause() {}, bind(name, callback) { callbacks[name] = callback; }, unbind() { unbound++; }, getCurrentSound(callback) { soundCallback = callback; } };
  const Widget = Object.assign(() => widget, { Events: { PLAY: "play", PAUSE: "pause", FINISH: "finish" } });
  window.SC = { Widget };
  const releaseSC = mountSoundCloud(document.createElement("iframe"), { key: "sdk-sc", fallbackTitle: "SC" });
  await until(() => callbacks.play, "SoundCloud SDK binds");
  callbacks.play(); releaseSC(); releaseSC(); soundCallback({ id: 100, title: "Late SC" });
  check(unbound === 3 && player.getSnapshot().nowPlaying?.title !== "Late SC", "SoundCloud teardown unbinds once and rejects pending metadata");
  window.fakeSpotify = { createController(_element, _options, callback) { callback({ togglePlay() {}, pause() {}, addListener() {}, destroy() { destroyed++; } }); } };
  const releaseSpotify = mountSpotify(document.createElement("div"), { key: "sdk-sp", fallbackTitle: "Spotify", url: "https://open.spotify.com/album/test", height: 200 });
  await until(() => document.querySelector('script[src*="spotify.com/embed/iframe-api"]'), "Spotify SDK starts");
  await tick(); await tick();
  releaseSpotify(); releaseSpotify();
  await until(() => destroyed === 1, "Spotify teardown destroys its controller exactly once");
  delete window.SC; delete window.fakeSpotify;
}

async function checkAdmin() {
  const original = { getSongs: api.getSongs, deleteSong: api.deleteSong, replaceSongAudio: api.replaceSongAudio, confirm: window.confirm };
  let replacement;
  api.getSongs = async () => [song];
  api.deleteSong = async () => { throw new ApiError("Deletion rejected", 403); };
  api.replaceSongAudio = (_id, _form, _key, progress) => {
    progress?.({ percent: 100 });
    return new Promise((_resolve, reject) => { replacement = { reject }; });
  };
  window.confirm = () => true;
  localStorage.setItem("clm_admin_key", "key");
  const view = mount(AdminUpload, {});
  const notice = () => view.element.querySelector("p.bg-brut-inverse")?.textContent ?? "";
  try {
    await until(() => [...view.element.querySelectorAll("button")].some(button => button.textContent.trim() === "delete"), "Admin catalog loads");
    const button = label => [...view.element.querySelectorAll("button")].find(button => button.textContent.trim() === label);
    button("delete").click();
    await until(() => view.element.textContent.includes("Deletion rejected"), "Admin reports failed deletion");
    check(!notice().includes("deleted"), "Failed deletion cannot publish a success notice");
    await until(() => button("replace"), "Optimistic rollback restores the row");
    const input = view.element.querySelector('input[type="file"][aria-label]');
    const transfer = new DataTransfer();
    transfer.items.add(new File(["wave"], "replacement.wav", { type: "audio/wav" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await tick(); button("replace").click();
    await until(() => replacement, "Replacement request starts");
    check(!notice().includes("replaced"), "Sending all bytes is not a confirmed replacement");
    replacement.reject(new ApiError("Replacement rejected", 403));
    await until(() => view.element.textContent.includes("Replacement rejected"), "Admin reports rejected replacement");
    check(!notice().includes("replaced"), "Rejected replacement cannot publish success");
  } finally {
    view.dispose(); api.getSongs = original.getSongs; api.deleteSong = original.deleteSong;
    api.replaceSongAudio = original.replaceSongAudio; window.confirm = original.confirm;
    localStorage.removeItem("clm_admin_key");
  }
}

async function checkBoard() {
  const nativeRequest = window.requestAnimationFrame, nativeCancel = window.cancelAnimationFrame;
  const NativeObserver = window.ResizeObserver;
  const frames = new Map();
  let frameId = 0, observers = 0, zooms = 0, stats;
  window.requestAnimationFrame = callback => { const id = ++frameId; frames.set(id, callback); return id; };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.ResizeObserver = class { constructor() { observers++; } observe() {} disconnect() { observers--; } };
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:160px;height:160px";
  document.body.append(canvas);
  const pigments = ["#ff0000", "#00ff00", "#0000ff", "#ffff00"].map(hex => makePigment(colorFor(hex), 1, 1));
  let settings = { ...DEFAULT_SETTINGS, detail: "low", tracers: false };
  let camera = createCamera();
  let board;
  const step = time => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); };
  try {
    board = mountPigmentBoard(canvas, { settings, pigments, camera, onStats(value) { stats = value; }, onZoom() { zooms++; }, onPan() {} });
    check(board && frames.size === 1 && observers === 1, "One board owns one frame loop and observer");
    step(performance.now() + 700);
    check(stats.cells > 0, "Board renders and reports its simulation size");
    settings = { ...settings, running: false };
    board.update({ settings, pigments, camera });
    step(performance.now() + 1400);
    const image = canvas.toDataURL();
    camera = createCamera();
    board.update({ settings, pigments, camera });
    step(performance.now() + 2100);
    check(canvas.toDataURL() === image, "Camera synchronization does not reset a paused simulation");
    const cells = stats.cells;
    board.update({ settings, pigments: [...pigments].reverse(), camera });
    step(performance.now() + 2800);
    check(stats.cells === cells, "Palette change preserves grid dimensions");
    settings = { ...settings, detail: "medium" };
    board.update({ settings, pigments, camera });
    step(performance.now() + 3500);
    check(stats.cells > cells && frames.size === 1, "Detail updates the existing board without adding a loop");
    const wheel = new WheelEvent("wheel", { deltaY: -1, cancelable: true });
    canvas.dispatchEvent(wheel);
    check(wheel.defaultPrevented && zooms === 1, "Wheel is non-passive and requests camera zoom");
    const staleFrame = [...frames.values()][0];
    board.reset(); board.dispose(); board.dispose(); staleFrame(performance.now() + 4200);
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -1, cancelable: true }));
    check(frames.size === 0 && observers === 0 && zooms === 1, "Dispose is idempotent and releases animation, observation and input");
  } finally {
    board?.dispose(); canvas.remove();
    window.requestAnimationFrame = nativeRequest; window.cancelAnimationFrame = nativeCancel; window.ResizeObserver = NativeObserver;
  }
}

window.runRefactorChecks = async () => {
  const completed = [];
  for (const [name, run] of Object.entries({ transport: checkTransport, resources: checkResources, queue: checkQueue, playback: checkPlayback, admin: checkAdmin, board: checkBoard })) {
    await run(); completed.push(name);
  }
  return completed;
};
`;

let browser;
let server;
try {
  const entryPath = join(temporary, "entry.js");
  await writeFile(entryPath, entry);
  execFileSync(process.execPath, ["build", entryPath, "--target", "browser", "--external", "astro:env/client", "--outdir", join(temporary, "bundle"), "--define", 'process.env.NODE_ENV="development"', "--define", "import.meta.env.DEV=false"], { cwd: root, stdio: "pipe" });
  const bundle = await readFile(join(temporary, "bundle", "entry.js"));
  server = createServer(async (request, response) => {
    if (request.url === "/entry.js") {
      response.writeHead(200, { "Content-Type": "text/javascript" }); response.end(bundle);
    } else if (request.url === "/env.js") {
      response.writeHead(200, { "Content-Type": "text/javascript" }); response.end("export const PUBLIC_API_URL = location.origin;");
    } else if (request.url === "/api/songs" && request.method === "POST") {
      for await (const _chunk of request) { /* Consume the real multipart request. */ }
      response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ success: true, data: { id: 1 } }));
    } else if (request.url === "/api/songs/1/audio") {
      for await (const _chunk of request) { /* Consume the real multipart request. */ }
      response.writeHead(204); response.end();
    } else {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end('<!doctype html><html><head><script type="importmap">{"imports":{"astro:env/client":"/env.js"}}</script><script type="module" src="/entry.js"></script></head><body></body></html>');
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  browser = await chromium.launch({ ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : process.platform === "win32" ? { channel: "msedge" } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://w.soundcloud.com/player/api.js", route => route.fulfill({ contentType: "text/javascript", body: "" }));
  await page.route("https://open.spotify.com/embed/iframe-api/v1", route => route.fulfill({ contentType: "text/javascript", body: "window.onSpotifyIframeApiReady(window.fakeSpotify);" }));
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.waitForFunction("typeof window.runRefactorChecks === 'function'");
  const completed = await page.evaluate("window.runRefactorChecks()").catch(error => {
    throw new AggregateError([error, ...errors.map(message => new Error(message))], "Browser regression failed");
  });
  assert.deepEqual(errors, [], "No unhandled browser errors");
  console.log(`PASS: ${completed.join(", ")}.`);
} finally {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
  assert.ok(basename(temporary).startsWith("cosmiclatte-refactor-"));
  await rm(temporary, { recursive: true, force: true });
}
