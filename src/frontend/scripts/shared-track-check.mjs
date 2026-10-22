import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const api = process.env.CHECK_API_URL ?? "http://127.0.0.1:8093";
const site = process.env.CHECK_SITE_URL ?? "http://127.0.0.1:5175";
const adminKey = process.env.CHECK_ADMIN_KEY ?? "local-shared-track-check";
for (const origin of [api, site]) {
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Use isolated local services for this check.");
}
const output = path.resolve("dist/checks/shared-track");
await mkdir(output, { recursive: true });
const wav = path.join(output, "source.wav");
execFileSync(process.env.FFMPEG_PATH ?? "ffmpeg", ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", "-ac", "2", wav]);
const bytes = await readFile(wav);

async function call(route, { method = "GET", body, admin = false, status = 200 } = {}) {
  const headers = {};
  if (admin) headers["X-Admin-Key"] = adminKey;
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${api}${route}`, {
    method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, status, `${method} ${route}: ${await response.clone().text()}`);
  return status === 204 ? undefined : (await response.json()).data;
}

function upload(title = "Shared WIP check with a long title that wraps on a phone") {
  const form = new FormData();
  form.set("title", title);
  form.set("artist", "Local preview check");
  form.set("file", new Blob([bytes], { type: "audio/wav" }), "source.wav");
  return form;
}

async function verifyAudio(url, name) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const file = path.join(output, `${name}.mp3`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  const probe = JSON.parse(execFileSync(process.env.FFPROBE_PATH ?? "ffprobe", ["-v", "error", "-show_streams", "-of", "json", file], { encoding: "utf8" }));
  assert.equal(probe.streams[0].codec_name, "mp3");
  assert.equal(Number(probe.streams[0].bit_rate), 128000);
  const ranged = await fetch(url, { headers: { Range: "bytes=0-1023" } });
  assert.equal(ranged.status, 206);
  assert.match(ranged.headers.get("content-range"), /^bytes 0-1023\//);
}

let song;
let browser;
try {
  song = await call("/api/songs", { method: "POST", body: upload(), admin: true, status: 201 });
  const shareRoute = `/api/songs/${song.id}/share`;
  await call(shareRoute, { method: "POST", status: 403 });
  await call(shareRoute, { status: 403 });
  await call(shareRoute, { method: "DELETE", status: 403 });
  const [shared, duplicate] = await Promise.all([0, 1].map(() => call(shareRoute, { method: "POST", admin: true, status: 201 })));
  assert.equal(shared.token, duplicate.token, "Concurrent share requests must reuse one active link.");
  assert.notEqual(shared.song.audioUrl, song.audioUrl);
  await verifyAudio(shared.song.audioUrl, "preview");
  console.log("API: shared MP3 is 128 kbps; concurrent creation and range requests passed.");
  await call("/api/shared-tracks/not-a-token", { status: 404 });

  browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "en-US" });
  await context.addInitScript(() => {
    if (!localStorage.getItem("cosmiclatte.locale")) localStorage.setItem("cosmiclatte.locale", "en");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
  const audioRequests = [];
  page.on("request", request => { if (request.url().includes("/api/local-audio/")) audioRequests.push(request.url()); });
  await page.goto(`${site}/share?token=${shared.token}`);
  await page.locator("[data-share-page]").waitFor();
  assert.equal(await page.title(), "Shared track | CosmicLatte");
  assert.equal(await page.locator("main").count(), 1);
  assert.equal(await page.locator("body > header, body > footer").count(), 0);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(0, 0, 0)");
  assert.equal(audioRequests.length, 0, "Opening the link must not download the audio for waveform analysis.");
  await page.getByRole("button", { name: "play", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[role="slider"][aria-label="seek"]')?.getAttribute("aria-valuenow")) > 0);
  assert.ok(audioRequests.every(url => url === shared.song.audioUrl));
  await page.getByRole("button", { name: "pause", exact: true }).click();
  await page.getByRole("button", { name: "rate 4 of 5", exact: true }).click();
  await page.getByText("4/5", { exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('button[aria-label="rate 4 of 5"]')?.disabled);
  await page.locator(".music-track-feedback form input").fill("Preview listener");
  await page.locator(".music-track-feedback form textarea").fill("Feedback from the shared preview.");
  await page.locator('.music-track-feedback button[type="submit"]').click();
  await page.locator(".music-track-feedback li").filter({ hasText: "Feedback from the shared preview." }).waitFor();
  await page.reload();
  await page.getByText("4/5", { exact: true }).waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Overflow at ${width}px`);
    await page.screenshot({ path: path.join(output, `share-${width}.png`), fullPage: true });
  }
  for (const [locale, label] of [["es", "temas en proceso"], ["fr", "morceaux en cours"], ["de", "Tracks in Arbeit"], ["ja", "制作中の楽曲"]]) {
    await page.evaluate(value => localStorage.setItem("cosmiclatte.locale", value), locale);
    await page.reload();
    await page.getByText(label, { exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
  await context.close();

  const admin = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], viewport: { width: 1200, height: 900 } });
  await admin.addInitScript(key => {
    localStorage.setItem("clm_admin_key", key);
    localStorage.setItem("cosmiclatte.locale", "en");
  }, adminKey);
  const adminPage = await admin.newPage();
  await adminPage.goto(`${site}/admin`);
  const row = adminPage.locator("li").filter({ hasText: song.title });
  await row.locator('input[readonly]').waitFor();
  assert.ok((await row.locator('input[readonly]').inputValue()).includes(shared.token));
  await adminPage.goto(`${site}/music`);
  await adminPage.locator(".music-catalog-item").filter({ hasText: song.title }).click();
  await adminPage.locator('[data-track-share] input[readonly]').waitFor();
  assert.ok((await adminPage.locator('[data-track-share] input[readonly]').inputValue()).includes(shared.token));
  await adminPage.goto(`${site}/admin`);
  await row.locator('input[readonly]').waitFor();
  await row.getByRole("button", { name: "disable link", exact: true }).click();
  await row.locator('input[readonly]').waitFor({ state: "detached" });
  await call(`/api/shared-tracks/${shared.token}`, { status: 404 });
  await row.getByRole("button", { name: "share track", exact: true }).click();
  await row.locator('input[readonly]').waitFor();
  const newToken = new URL(await row.locator('input[readonly]').inputValue()).searchParams.get("token");
  assert.notEqual(newToken, shared.token);
  await call(`/api/shared-tracks/${shared.token}`, { status: 404 });
  const enabled = await call(`/api/shared-tracks/${newToken}`);
  const replacement = new FormData();
  replacement.set("file", new Blob([bytes], { type: "audio/wav" }), "replacement.wav");
  await call(`/api/songs/${song.id}/audio`, { method: "PUT", body: replacement, admin: true });
  const refreshed = await call(`/api/shared-tracks/${newToken}`);
  assert.equal(refreshed.token, newToken);
  assert.notEqual(refreshed.song.audioUrl, enabled.song.audioUrl);
  await verifyAudio(refreshed.song.audioUrl, "replacement-preview");
  assert.equal((await fetch(enabled.song.audioUrl)).status, 404);
  await call(`/api/songs/${song.id}`, { method: "DELETE", admin: true, status: 204 });
  song = undefined;
  await call(`/api/shared-tracks/${newToken}`, { status: 404 });
  assert.equal((await fetch(refreshed.song.audioUrl)).status, 404);
  console.log("Shared track check passed: 128 kbps MP3, range playback, concurrent creation, comments, ratings, five locales, 320–1440px, admin sharing, revocation, replacement and deletion.");
} finally {
  await browser?.close();
  if (song) await call(`/api/songs/${song.id}`, { method: "DELETE", admin: true, status: 204 });
}
