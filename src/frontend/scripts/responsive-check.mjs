import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const output = process.env.SCREENSHOT_DIR;
const widths = [320, 375, 390, 639, 640, 768, 1023, 1024, 1280, 1599, 1600, 1920];
const viewports = widths.map(width => ({ width, height: 900 }));
viewports.push({ width: 844, height: 390 }, { width: 568, height: 320 });
const routes = process.argv.includes("--contact") ? ["/contact"]
  : ["/", "/coding", "/music", "/experimentation", "/experimentation/spectral", "/experimentation/subdivision", "/admin", "/loading", "/contact"];
const longText = "LongUnbrokenContent".repeat(12);
const song = { id: 1, title: longText, artist: longText, duration: "3:24", createdAt: "2026-01-01T00:00:00Z", audioUrl: `${baseURL}/responsive-audio.wav`, avgRating: 4.5, totalVotes: 1234 };
const album = { id: "responsive", title: longText, trackCount: 12, setType: "album", releaseDate: "2026-01-01", url: "https://soundcloud.com/example/sets/responsive" };
const comment = { id: 1, songId: 1, author: longText, content: longText, createdAt: "2026-01-01T00:00:00Z" };
const browser = await chromium.launch({
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
});
if (process.argv.includes("--music-preview")) {
  try { await checkMusicPreview(); }
  finally { await browser.close(); }
  process.exit(0);
}

async function checkMusicPreview() {
  const artwork = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#2448c8"/><circle cx="150" cy="150" r="90" fill="#f3f1eb"/></svg>')}`;
  const releases = [
    { id: "motion", title: "m0Tion", trackCount: 10, artworkUrl: artwork, url: "https://soundcloud.com/cosmiclattemusic/sets/m0tion" },
    { id: "second", title: "Second Release", trackCount: 30, artworkUrl: artwork, url: "https://soundcloud.com/example/sets/second" },
  ];
  const songs = [
    { ...song, title: "First Track", artist: "CosmicLatte", audioUrl: `${baseURL}/preview-test.wav` },
    { ...song, id: 2, title: "Second Track", artist: "CosmicLatte", audioUrl: `${baseURL}/preview-test.wav?second` },
    { ...song, id: 3, audioUrl: `${baseURL}/preview-test.wav?long` },
  ];
  const audio = Buffer.alloc(44 + 8000 * 2 * 30);
  audio.write("RIFF"); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28); audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34); audio.write("data", 36); audio.writeUInt32LE(audio.length - 44, 40);
  for (const viewport of [{ width: 320, height: 740 }, { width: 768, height: 900 }, { width: 1440, height: 1000 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    const errors = [];
    let failSongs = false, failAlbums = false, commentRequests = 0;
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      window.previewPlays = 0;
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.previewPlays++; return play.call(this); };
    });
    await page.route(`${baseURL}/**`, async route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = pathname.includes(".") ? pathname : `${pathname.replace(/\/$/, "")}/index.html`;
      const contentType = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".png") ? "image/png" : "text/html";
      await route.fulfill({ body: await readFile(`dist/client${file}`), contentType });
    });
    await page.route("**/preview-test.wav*", route => route.fulfill({ body: audio, contentType: "audio/wav", headers: { "Access-Control-Allow-Origin": "*" } }));
    await page.route(/fonts\.google/, route => route.abort());
    await page.route("https://w.soundcloud.com/player/api.js", route => route.fulfill({ contentType: "text/javascript", body: "" }));
    await page.route("https://open.spotify.com/embed/iframe-api/v1", route => route.fulfill({ contentType: "text/javascript", body: "window.onSpotifyIframeApiReady(null)" }));
    await page.route(/https:\/\/(w\.soundcloud\.com\/player\/\?|open\.spotify\.com\/embed\/album\/|www\.youtube\.com\/embed\/|embed\.music\.apple\.com\/)/, route => route.fulfill({ contentType: "text/html", body: '<body style="margin:0;background:#eee;font:16px monospace;padding:20px">Streaming player fixture<br>Track list</body>' }));
    await page.route("**/health", route => route.fulfill({ json: { success: true, data: { status: "UP" } } }));
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/comments")) commentRequests++;
      const albumsRequest = path.includes("/albums/");
      const failed = albumsRequest ? failAlbums : failSongs;
      const data = albumsRequest ? releases : path.endsWith("/comments") ? [] : /\/songs\/\d+$/.test(path) ? songs[0] : path.endsWith("/ratings") ? {} : songs;
      await route.fulfill({ status: failed ? 503 : 200, json: { success: !failed, data } });
    });
    const settle = () => page.waitForFunction(() => !document.documentElement.matches("[data-boot-pending], .boot-locked, .route-locked"));
    await page.goto(`${baseURL}/music`);
    await page.locator("astro-island:not([ssr])").waitFor({ state: "attached" });
    await settle();
    const list = page.locator(".music-catalog-list");
    await list.getByRole("button", { name: /Second Release/ }).waitFor();
    await list.getByRole("button", { name: /First Track/ }).waitFor();
    const title = page.locator("#music-preview-title");
    assert.equal(await title.textContent(), "m0Tion");
    assert.equal(await page.locator(".music-preview iframe").count(), 1);
    await page.getByRole("button", { name: "Next release or track", exact: true }).click();
    assert.equal(await title.textContent(), "Second Release");
    const region = page.locator(".music-preview-content");
    const scroll = await region.evaluate(element => ({ height: element.clientHeight, full: element.scrollHeight }));
    assert.ok(scroll.full > scroll.height, "Long albums remain scrollable inside the preview");
    await region.evaluate(element => { element.scrollTop = element.scrollHeight; });
    assert.ok(await region.evaluate(element => element.scrollTop > 0));
    await page.getByRole("button", { name: "Next release or track", exact: true }).click();
    assert.equal(await title.textContent(), "First Track");
    assert.equal(await page.locator(".music-preview iframe").count(), 0);
    assert.equal(commentRequests, 0, "Selecting a track does not load comments");
    assert.equal(await page.evaluate(() => window.previewPlays), 0, "Browsing does not autoplay");
    await page.locator(".music-track-preview").getByRole("button", { name: "play", exact: true }).click();
    await page.locator(".music-track-preview").getByRole("button", { name: "pause", exact: true }).waitFor();
    await list.getByRole("button", { name: /Second Track/ }).click();
    assert.equal(await title.textContent(), "Second Track");
    assert.equal(await page.locator(".music-track-preview [role=slider]").getAttribute("aria-disabled"), "true");
    assert.equal(await page.locator(".music-track-preview [role=slider]").getAttribute("aria-valuenow"), "0");
    assert.equal(await page.evaluate(() => window.previewPlays), 1, "Changing previews leaves playback explicit");
    await page.getByRole("button", { name: "comments", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".music-track-feedback textarea"));
    assert.equal(commentRequests, 1);
    await list.getByRole("button", { name: /m0Tion/ }).click();
    await page.getByRole("button", { name: "Spotify", exact: true }).click();
    await page.waitForFunction(() => !!document.querySelector('.music-preview iframe[src*="spotify"]'));
    const embed = await page.locator(".music-preview iframe").elementHandle();
    for (const locale of ["es", "fr", "de", "ja", "en"]) {
      await page.locator("[data-language-select]").selectOption(locale);
      assert.equal(await title.textContent(), "m0Tion");
      assert.ok(await embed.evaluate(element => element.isConnected), "Locale changes keep the mounted embed");
    }
    await page.getByRole("button", { name: "Next release or track", exact: true }).focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal(await title.textContent(), longText, "Keyboard navigation wraps to the last entry");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Long titles do not cause page overflow");
    await list.getByRole("button", { name: /m0Tion/ }).click();
    await page.locator(".music-preview-navigation").evaluate(element => scrollTo(0, scrollY + element.getBoundingClientRect().top));
    await mkdir("dist/checks", { recursive: true });
    await page.screenshot({ path: `dist/checks/music-preview-${viewport.width}.png` });
    failSongs = true;
    await page.reload(); await settle();
    await list.getByRole("button", { name: /Second Release/ }).waitFor();
    assert.equal(await title.textContent(), "m0Tion", "Track errors retain the release preview");
    failSongs = false; failAlbums = true;
    await page.reload(); await settle();
    await list.getByRole("button", { name: /First Track/ }).click();
    assert.equal(await title.textContent(), "First Track", "Release errors retain tracks");
    assert.deepEqual(errors, [], "No browser or hydration errors");
    await page.close();
  }
  console.log("PASS: unified music previews, list/buttons/keyboard navigation, one embed, no autoplay, playback isolation, comments, independent failures, five locales and responsive layout.");
}
if (process.argv.includes("--experiments")) {
  try {
    for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 568, height: 320 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
      const page = await browser.newPage({ viewport });
      await page.route(/fonts\.google/, route => route.abort());
      await page.route(`${baseURL}/**`, async route => {
        const pathname = new URL(route.request().url()).pathname;
        const file = pathname.includes(".") ? pathname : `${pathname.replace(/\/$/, "")}/index.html`;
        const contentType = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html";
        await route.fulfill({ body: await readFile(`dist/client${file}`), contentType });
      });
      for (const route of ["spectral", "subdivision"]) {
        await page.goto(`${baseURL}/experimentation/${route}`);
        await page.locator("astro-island:not([ssr])").first().waitFor({ state: "attached" });
        await page.waitForFunction(() => !document.documentElement.matches("[data-boot-pending], .boot-locked"));
        const slider = page.locator('input[type="range"]').last();
        await slider.scrollIntoViewIfNeeded();
        await slider.focus();
        await page.keyboard.press("ArrowRight");
        const box = await page.locator(".experiment-preview").boundingBox();
        assert.ok(box && box.y >= -1 && box.y + box.height <= viewport.height, `${route}: preview remains visible at ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}`);
        if (viewport.width < 1024) assert.ok(box.height < viewport.height / 2, "Preview leaves space for controls");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
      }
      await page.close();
    }
    console.log("PASS: experiment controls and sticky previews across phone, landscape and desktop.");
  } finally {
    await browser.close();
  }
  process.exit(0);
}
if (process.argv.includes("--theme-motion") || process.argv.includes("--theme") || process.argv.includes("--loading") || process.argv.includes("--cursor") || process.argv.includes("--music")) {
  try {
    if (process.argv.includes("--theme-motion")) await checkThemeTransition();
    else if (process.argv.includes("--theme")) await checkTheme();
    else if (process.argv.includes("--cursor")) await checkCursor();
    else if (process.argv.includes("--music")) await checkMusicComposition();
    else await checkLoading();
  } finally {
    await browser.close();
  }
  process.exit(0);
}
const failures = [];
let checks = 0;
if (output) await mkdir(output, { recursive: true });

async function checkTheme() {
  if (output) await mkdir(output, { recursive: true });
  for (const blocked of [false, true]) {
    const context = await browser.newContext({ colorScheme: "dark", reducedMotion: "reduce" });
    await context.route(/fonts\.google/, route => route.abort());
    if (blocked) await context.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.stack ?? error.message));
    await page.goto(baseURL + "/contact");
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-boot-pending"));
    const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
    const palette = () => page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      scheme: getComputedStyle(document.documentElement).colorScheme,
      background: getComputedStyle(document.body).backgroundColor,
      field: getComputedStyle(document.querySelector("input")).backgroundColor,
    }));
    const light = await palette();
    assert.equal(light.theme, "light", "Light is the default even on a dark OS");
    assert.equal(light.scheme, "light");
    assert.equal(await toggle.evaluate(element => getComputedStyle(element).borderRightWidth), "2px", "The theme toggle has a right border");
    await toggle.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    const dark = await palette();
    assert.equal(dark.scheme, "dark");
    assert.notEqual(dark.background, light.background);
    assert.notEqual(dark.field, light.field);
    assert.equal(await toggle.getAttribute("aria-pressed"), "true");
    await page.getByRole("navigation").locator('a[href="/"]').click();
    await page.waitForURL(baseURL + "/");
    await page.waitForFunction(() => !document.documentElement.classList.contains("route-locked"));
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", "Theme survives Astro navigation");
    for (const width of [320, 640, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await toggle.isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `No overflow at ${width}px`);
      if (output && !blocked) await page.screenshot({ path: `${output}/theme-dark-${width}.png` });
    }
    await page.reload();
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-boot-pending"));
    assert.equal(await page.locator("html").getAttribute("data-theme"), blocked ? "light" : "dark");
    if (!blocked) {
      await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.getAttribute("aria-pressed") === "true");
      await toggle.click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
      assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
      await page.reload();
      assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
      await page.evaluate(() => localStorage.setItem("clm_theme", "invalid"));
      await page.reload();
      assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
      if (output) await page.screenshot({ path: `${output}/theme-light-1280.png` });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: "dark" });
  const page = await context.newPage();
  await context.route(/fonts\.google/, route => route.abort());
  await page.goto(baseURL + "/contact");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  assert.equal(await page.locator("[data-theme-toggle]").isVisible(), false);
  await context.close();
  console.log("PASS: theme defaults, keyboard toggle, rendered colors, navigation, persistence, mobile widths, blocked storage, invalid preference, and no-JavaScript fallback.");
}

async function checkThemeTransition() {
  if (output) await mkdir(output, { recursive: true });
  const context = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await context.route(/fonts\.google/, route => route.abort());
  await context.route(`${baseURL}/**`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    const file = pathname.includes(".") ? pathname : `${pathname.replace(/\/$/, "")}/index.html`;
    await route.fulfill({ path: `dist/client${file}` });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const time = new Date("2026-10-16T12:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.goto(baseURL + "/contact");
  await page.clock.runFor(7000);
  const toggle = page.locator("[data-theme-toggle]");
  const curtain = page.locator(".theme-curtain");
  await page.evaluate(() => {
    const root = document.documentElement;
    new MutationObserver(() => {
      const canvas = document.querySelector(".theme-curtain");
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const data = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
      if (!data) return;
      let opaque = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] === 255) opaque++;
      root.dataset.testSwapCoverage = String(opaque / (data.length / 4));
    }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  });
  const theme = () => page.locator("html").getAttribute("data-theme");
  const sample = () => curtain.evaluate(canvas => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing theme canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Missing theme context");
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      assertBinary(data[i]);
      if (data[i] === 255) opaque++;
    }
    function assertBinary(alpha) {
      if (alpha !== 0 && alpha !== 255) throw new Error("Dithering must use binary alpha");
    }
    return { coverage: opaque / (data.length / 4), pixels: canvas.width * canvas.height,
      pointerEvents: getComputedStyle(canvas).pointerEvents, hidden: canvas.getAttribute("aria-hidden") };
  });
  const idle = async () => {
    assert.equal(await curtain.count(), 0);
    assert.equal(await page.locator("html").getAttribute("data-theme-transition"), null);
    assert.equal(await toggle.getAttribute("aria-disabled"), "false");
  };
  for (const target of ["dark", "light"]) {
    const source = await theme();
    await toggle.focus();
    await page.keyboard.press("Space");
    assert.equal(await theme(), source, "The old theme stays until fully covered");
    assert.equal(await toggle.getAttribute("aria-disabled"), "true");
    await page.clock.runFor(80);
    const covering = await sample();
    assert.ok(covering.coverage > 0 && covering.coverage < 1);
    assert.ok(covering.pixels < 101000, "Backing pixels stay bounded even at DPR 2");
    assert.equal(covering.pointerEvents, "none");
    assert.equal(covering.hidden, "true");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "The mask must not widen the viewport");
    await toggle.evaluate(button => { if (button instanceof HTMLButtonElement) button.click(); });
    assert.equal(await curtain.count(), 1, "Repeated clicks never stack canvases");
    await page.clock.runFor(144);
    assert.equal(await theme(), target);
    assert.equal(await page.locator("html").getAttribute("data-test-swap-coverage"), "1", "The swap is hidden by an opaque mask");
    await page.clock.runFor(112);
    const revealing = await sample();
    assert.ok(revealing.coverage > 0 && revealing.coverage < 1);
    if (output) await page.screenshot({ path: `${output}/theme-reveal-${target}.png` });
    await page.clock.runFor(200);
    await idle();
    assert.equal(await toggle.evaluate(button => button === document.activeElement), true, "Focus stays on the selector");
    assert.equal(await page.evaluate(() => localStorage.getItem("clm_theme")), target);
  }

  await toggle.click({ force: true });
  await page.clock.runFor(80);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(32);
  await idle();
  assert.equal(await theme(), "dark", "Resize settles on the requested theme");
  await toggle.click({ force: true });
  await page.clock.runFor(80);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(32);
  await idle();
  assert.equal(await theme(), "light");
  await toggle.click({ force: true });
  await idle();
  assert.equal(await theme(), "dark", "Reduced motion applies without a curtain");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await toggle.click({ force: true });
  await page.clock.runFor(80);
  await page.getByRole("navigation").locator('a[href="/"]').click({ force: true });
  await page.clock.runFor(7500);
  await page.waitForURL(baseURL + "/");
  await idle();
  assert.equal(await theme(), "light", "Navigation commits and releases the transition");
  await page.reload();
  await page.clock.runFor(7000);
  await idle();
  assert.equal(await theme(), "light", "Reload restores the preference without an effect");
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      if (this.classList.contains("theme-curtain")) throw new Error("Canvas unavailable");
      return original.apply(this, args);
    };
  });
  await toggle.click({ force: true });
  await idle();
  assert.equal(await theme(), "dark", "An unavailable canvas still applies the theme");
  assert.deepEqual(errors, []);
  await context.close();
  console.log("PASS: Bayer binary pixels, concealed theme swap, both directions, rapid clicks, focus, DPR cap, resize, reduced motion, navigation, reload, and canvas failure recovery.");
}

async function checkCursor() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.route(/fonts\.google/, route => route.abort());
  await page.goto(baseURL + "/contact");
  await page.waitForFunction(() => !document.documentElement.matches("[data-boot-pending], .boot-locked"));
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.style.cssText = "position:fixed;left:100px;top:200px;z-index:60;background:white;padding:30px";
    fixture.innerHTML = '<input id="cursor-text" type="text"><textarea id="cursor-area"></textarea><input id="cursor-range" type="range"><div id="cursor-editable" contenteditable="true">edit</div>';
    document.body.append(fixture);
  });
  const canvas = page.locator("[data-morphling-cursor]");
  const languageSelector = page.locator("[data-language-scope]");
  await languageSelector.hover();
  await page.waitForTimeout(300);
  const selectorBox = await languageSelector.boundingBox();
  assert.ok(selectorBox);
  const selectorOutline = await canvas.evaluate((element, box) => {
    if (!(element instanceof HTMLCanvasElement)) return { width: 0, height: 0 };
    const density = element.width / window.innerWidth;
    const left = Math.floor((box.x - 20) * density);
    const top = Math.floor((box.y - 20) * density);
    const width = Math.ceil((box.width + 40) * density);
    const height = Math.ceil((box.height + 40) * density);
    const context = element.getContext("2d");
    if (!context) return { width: 0, height: 0 };
    const image = context.getImageData(left, top, width, height);
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (image.data[(y * width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const alphaAt = (x, y) => image.data[(y * width + x) * 4 + 3];
    const squareCornerAlpha = alphaAt(Math.round(13 * density), Math.round(13 * density));
    const topEdgeAlpha = alphaAt(Math.round((20 + box.width / 2) * density), Math.round(13 * density));
    return { width: (maxX - minX + 1) / density, height: (maxY - minY + 1) / density, squareCornerAlpha, topEdgeAlpha };
  }, selectorBox);
  assert.ok(selectorOutline.width >= selectorBox.width + 10, `Cursor wraps the full language control: ${JSON.stringify(selectorOutline)}`);
  assert.ok(selectorOutline.height >= selectorBox.height + 10, `Cursor wraps the full language control: ${JSON.stringify(selectorOutline)}`);
  assert.ok(selectorOutline.squareCornerAlpha > 0, "The cursor keeps control corners square");
  assert.ok(selectorOutline.topEdgeAlpha > 0, "The cursor outlines the control edge");
  for (const selector of ["#cursor-text", "#cursor-area", "#cursor-editable", "#cursor-range"]) {
    const target = page.locator(selector);
    await target.hover();
    await page.waitForTimeout(300);
    const mode = selector === "#cursor-range" ? "precision" : "text";
    assert.equal(await canvas.getAttribute("data-mode"), mode);
    assert.equal(await target.evaluate(element => getComputedStyle(element).cursor), "none");
    const box = await target.boundingBox();
    assert.ok(box);
    const pixels = await canvas.evaluate((element, pointer) => {
      const density = element.width / window.innerWidth;
      const size = Math.round(80 * density);
      const image = element.getContext("2d").getImageData(Math.round((pointer.x - 40) * density), Math.round((pointer.y - 40) * density), size, size);
      let left = size, right = 0, top = size, bottom = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (image.data[(y * size + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      return { width: (right - left + 1) / density, height: (bottom - top + 1) / density };
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    assert.ok(pixels.width <= (mode === "text" ? 13 : 22), `${mode} outline must stay compact: ${JSON.stringify(pixels)}`);
    assert.ok(pixels.height >= 24 && pixels.height <= 32, `${mode} must draw its silhouette: ${JSON.stringify(pixels)}`);
    if (output) {
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/cursor-${selector.slice(1)}.png` });
    }
  }
  await page.mouse.down();
  await page.mouse.move(900, 600);
  assert.equal(await canvas.getAttribute("data-mode"), "precision", "Precision persists throughout a drag");
  await page.mouse.up();
  assert.equal(await canvas.getAttribute("data-mode"), "default");
  await page.locator("#cursor-text").fill("Cursor editing still works");
  assert.equal(await page.locator("#cursor-text").inputValue(), "Cursor editing still works");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await canvas.evaluate(element => getComputedStyle(element).display), "none");
  assert.equal(await page.locator("#cursor-text").evaluate(element => getComputedStyle(element).cursor), "text");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const persistedCanvas = await canvas.elementHandle();
  await page.locator('a[href="/experimentation"]').first().click();
  await page.waitForURL(url => url.pathname.replace(/\/+$/, "") === "/experimentation");
  await page.waitForFunction(() => !document.documentElement.matches(".route-locked"));
  assert.equal(await persistedCanvas.evaluate(element => element === document.querySelector("[data-morphling-cursor]")), true);
  await page.locator('a[href="/experimentation/subdivision"]').click();
  await page.waitForURL(url => url.pathname.replace(/\/+$/, "") === "/experimentation/subdivision");
  await page.waitForFunction(() => !document.documentElement.matches(".route-locked"));
  await page.locator('input[type="range"]').first().hover();
  assert.equal(await canvas.getAttribute("data-mode"), "precision");
  assert.equal(await page.locator('input[type="range"]').first().evaluate(element => getComputedStyle(element).cursor), "none");
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Cursor checks passed: full language control, square target outline, text/range silhouettes, drag, editing, reduced-motion fallback, and navigation persistence.");
}

async function checkMusicComposition() {
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(/fonts\.google|api\.spotify|soundcloud\.com/, route => route.abort());
    await page.route(/\/api\//, route => route.fulfill({ json: { success: true, data: [] } }));
    await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
    await page.locator('a.editorial-link[href="/music"]').click();
    await page.waitForURL(url => url.pathname.replace(/\/+$/, "") === "/music");
    await page.waitForFunction(() => !document.documentElement.classList.contains("route-locked"));

    for (const cycle of ["first visit", "after Astro navigation"]) {
      assert.equal(await page.locator("main").count(), 1, "Layout owns the main landmark");
      await page.locator(".music-intro a[href='#music-catalog']").click();
      await page.waitForFunction(() => {
        const bounds = document.querySelector("#music-catalog").getBoundingClientRect();
        return bounds.top >= -1 && bounds.top < innerHeight;
      });
      assert.equal(await page.locator("#albums-title").count(), 1);
      assert.equal(await page.locator("#tracks-title").count(), 1);
      const catalog = await page.locator("#music-catalog").boundingBox();
      const journey = await page.locator(".journey").boundingBox();
      assert.ok(catalog && journey && journey.y >= catalog.y + catalog.height - 1, "Journey follows the whole catalog");
      const present = await page.locator(".journey-present").evaluate(card => {
        const style = getComputedStyle(card);
        const prose = card.querySelector(":scope > p:not(.brut-label)");
        return {
          prose: prose.getBoundingClientRect().width,
          column: card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        };
      });
      assert.ok(Math.abs(present.prose - present.column) < 1, `Present-day prose fills its column: ${JSON.stringify(present)}`);
      await page.locator(".journey-today a[href='#music-catalog']").click();
      await page.waitForFunction(() => {
        const bounds = document.querySelector("#music-catalog").getBoundingClientRect();
        return bounds.top >= -1 && bounds.top < innerHeight;
      });
      if (cycle === "first visit") {
        await page.locator('nav a[href="/"]').click();
        await page.waitForURL(url => url.pathname === "/" || url.pathname === "");
        await page.waitForFunction(() => !document.documentElement.classList.contains("route-locked"));
        await page.locator('nav a[href="/music"]').click();
        await page.waitForURL(url => url.pathname.replace(/\/+$/, "") === "/music");
        await page.waitForFunction(() => !document.documentElement.classList.contains("route-locked"));
      }
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal page overflow at ${viewport.width}px`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Music composition checks passed from the home CTA, on initial entry and after returning through Astro navigation, at phone and desktop sizes.");
}

async function checkLoading() {
  const errors = [];
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ reducedMotion, viewport: { width: 390, height: 844 } });
    await context.route("**/api/**", route => route.fulfill({ json: { success: true, data: [] } }));
    await context.route(/fonts\.google/, route => route.abort());
    await context.addInitScript(() => {
      sessionStorage.setItem("clm_boot_seen", "1");
      window.loadingEvents = [];
      for (const name of ["astro:before-preparation", "astro:after-swap", "astro:page-load"]) {
        document.addEventListener(name, () => queueMicrotask(() => {
          window.loadingEvents.push({ name, state: document.querySelector("[data-route-curtain]")?.dataset.state });
        }));
      }
      function firstPaint() {
        if (!document.querySelector("main")) return requestAnimationFrame(firstPaint);
        window.loadingFirstPaint = {
          pending: document.documentElement.hasAttribute("data-boot-pending"),
          mainVisibility: getComputedStyle(document.querySelector("main")).visibility,
          bootDisplay: getComputedStyle(document.querySelector("[data-boot-screen]")).display,
        };
      }
      requestAnimationFrame(firstPaint);
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    const settle = () => page.waitForFunction(() =>
      !document.documentElement.matches("[data-boot-pending], .boot-locked, .route-locked")
      && !document.querySelector("main").inert);
    await page.goto(baseURL + "/");
    await settle();
    assert.deepEqual(await page.evaluate(() => window.loadingFirstPaint), {
      pending: true, mainVisibility: "hidden", bootDisplay: "flex",
    }, "Loading must precede content, including visits with the old session flag");
    await page.reload();
    await settle();
    assert.equal(await page.evaluate(() => window.loadingFirstPaint.pending), true, "Warm reloads must show loading");

    await page.locator('a[href="/experimentation"]').first().click();
    await page.waitForURL("**/experimentation");
    await settle();
    const events = await page.evaluate(() => window.loadingEvents.filter(event => event.name !== "astro:page-load" || event.state));
    assert.ok(events.length >= 3);
    assert.ok(events.every(event => event.state === "in"), JSON.stringify(events));

    await page.route("**/experimentation/subdivision", async route => {
      await new Promise(resolve => setTimeout(resolve, 1800));
      await route.continue();
    });
    await page.locator('a[href="/experimentation/subdivision"]').first().click();
    const curtain = page.locator("[data-route-curtain]");
    await curtain.waitFor({ state: "visible" });
    assert.equal(await curtain.getAttribute("data-state"), "in");
    const canvas = curtain.locator("canvas");
    const pixels = () => canvas.evaluate(element => element.toDataURL());
    const before = await pixels();
    await page.waitForTimeout(250);
    const after = await pixels();
    assert.equal(before === after, reducedMotion === "reduce", "Motion must follow the visitor preference");
    if (output) {
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: output + "/loading-" + reducedMotion + ".png" });
    }
    await page.waitForURL("**/experimentation/subdivision");
    await settle();
    await page.locator('a[href="/"]').first().click();
    await page.waitForURL(baseURL + "/");
    await settle();
    assert.equal(await curtain.getAttribute("data-state"), null);

    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "/experimentation/subdivision";
      document.body.append(link);
      link.click();
      setTimeout(() => document.querySelector('a[href="/experimentation"]').click(), 30);
    });
    await page.waitForURL("**/experimentation");
    await settle();
    await page.waitForTimeout(1900);
    assert.equal(await curtain.getAttribute("data-state"), null, "Stale navigation must not reactivate loading");

    await page.goBack();
    await settle();
    await page.goto(baseURL + "/loading");
    await page.locator('[data-boot-screen][data-state="active"]').waitFor();
    await page.locator('a[href="/"]').first().dispatchEvent("click");
    await page.waitForURL(baseURL + "/");
    await settle();
    await page.waitForTimeout(1700);
    assert.equal(await page.locator('[data-boot-screen][data-state="active"]').count(), 0, "An abandoned replay must not restart");
    await context.close();
  }

  const blocked = await browser.newContext();
  await blocked.route("**/*", route => route.request().resourceType() === "script" ? route.abort() : route.continue());
  const page = await blocked.newPage();
  await page.goto(baseURL + "/");
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-boot-pending"));
  assert.equal(await page.locator("main").evaluate(element => getComputedStyle(element).visibility), "visible");
  await blocked.close();

  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJS.newPage();
  await staticPage.goto(baseURL + "/");
  assert.equal(await staticPage.locator("main").isVisible(), true);
  await noJS.close();
  assert.deepEqual(errors, [], "Loading must not produce browser errors");
  console.log("PASS: loading precedes content on initial paint, reloads, warm and slow navigation, history and replay exit; motion, cancellation and failed-bundle recovery work.");
}

async function check(page, label, touch) {
  await page.waitForTimeout(100);
  const issues = await page.evaluate(({ touch, expectedWidth }) => {
    const issues = [];
    const width = document.documentElement.clientWidth;
    if (width > expectedWidth + 1 || innerWidth > expectedWidth + 1) issues.push("mobile layout expands beyond device width");
    if (touch && !matchMedia("(pointer: coarse)").matches) issues.push("touch emulation is inactive");
    if (document.documentElement.scrollWidth > width + 1) issues.push("page scrolls horizontally");
    for (const el of document.querySelectorAll("main *, header a, footer *")) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || el.closest('[role="region"], .boot-screen, .route-curtain')) continue;
      if (el.parentElement?.closest(".truncate")) continue;
      if (rect.right > width + 1 || rect.left < -1) issues.push(`${el.tagName}: outside viewport (${el.textContent?.slice(0, 30)})`);
      if (touch && el.matches('button, input[type="range"]') && rect.height < 43.5) issues.push(`${el.tagName}: touch height ${rect.height}`);
      if (el.matches(".soc") && rect.height > 64) issues.push("social button is stretched vertically");
    }
    if (touch && matchMedia("(hover: none)").matches) {
      for (const name of document.querySelectorAll(".soc__name")) {
        if (!name.getBoundingClientRect().width) issues.push("platform name is hidden on touch");
      }
    }
    const heading = document.querySelector("h1");
    if (heading?.querySelector(".brut-word")) {
      const h = heading.getBoundingClientRect();
      const m = document.querySelector("main").getBoundingClientRect();
      if (Math.abs((h.left + h.right) / 2 - (m.left + m.right) / 2) > 1) issues.push("home heading is not centered");
    }
    const canvas = document.querySelector('canvas[aria-label^="pigment board"]');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      if (Math.abs(rect.width - rect.height) > 1) issues.push("pigment board is not square");
    }
    return [...new Set(issues)];
  }, { touch, expectedWidth: page.viewportSize().width });
  checks++;
  if (issues.length) failures.push({ label, viewport: page.viewportSize(), issues });
}

try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({ reducedMotion: "reduce", hasTouch: touch, isMobile: touch });
    await context.addInitScript(() => sessionStorage.setItem("clm_boot_seen", "1"));
    let state = "populated";
    let contactState = "error";
    const submissions = [];
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/contact/messages" && route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        submissions.push(body);
        if (contactState === "network") return route.abort();
        if (contactState === "error") return route.fulfill({ status: 503, json: { success: false, message: "Service unavailable", data: null } });
        const data = contactState === "invalid" ? { status: "accepted" }
          : { messageId: "3b731917-117e-4f60-9897-abdef2ec7dd4", status: "accepted" };
        return route.fulfill({ status: 202, json: { success: true, data, message: "Accepted", meta: null, errors: null } });
      }
      if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
        if (state === "error") return route.fulfill({ status: 503, json: { success: false, message: "Service unavailable" } });
        if (state === "loading") {
          await new Promise(resolve => setTimeout(resolve, 2500));
          return route.abort().catch(() => {});
        }
        assert.equal(route.request().method(), "GET", "Responsive checks must not mutate API data");
        const data = url.pathname.includes("comments") ? [comment]
          : url.pathname.includes("songs") ? [song]
          : url.pathname === "/health" ? { status: "UP", service: "fixture" } : [album];
        return route.fulfill({ json: { success: true, data } });
      }
      if (/soundcloud|spotify/.test(url.hostname) || url.pathname === "/responsive-audio.wav") return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    for (const path of routes) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(baseURL + path, { waitUntil: "domcontentloaded" });
      // Attached, not visible: the bar only shows once a source has something to
      // report, so on a route with no playback the widget stays hidden.
      await page.locator("now-playing-el > div").waitFor({ state: "attached" });
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      if (path === "/music") {
        await page.locator('.music-catalog-list section[aria-labelledby="tracks-title"] button').first().click();
        await page.getByRole("button", { name: "comments", exact: true }).click();
        await page.getByText(longText, { exact: true }).last().waitFor();
        await page.getByRole("button", { name: "play", exact: true }).last().click();
        await page.locator("now-playing-el .text-brut-red").waitFor();
      }
      if (path === "/admin") {
        await page.locator('input[type="password"]').fill("responsive-fixture");
        await page.locator("#queue-input").setInputFiles({ name: longText + ".mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(128) });
        await page.getByRole("button", { name: /quitar/ }).waitFor();
      }
      if (path === "/experimentation/spectral") await page.locator("details").evaluate(el => el.open = true);
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await check(page, `${path} ${touch ? "touch" : "mouse"}`, touch);
        if (output && [375, 1024, 1920].includes(viewport.width)) {
          await page.screenshot({ path: `${output}/${path === "/" ? "home" : path.slice(1).replaceAll("/", "-")}-${touch ? "touch" : "mouse"}-${viewport.width}.png`, fullPage: true });
        }
      }
      if (path === "/experimentation/spectral") {
        for (const board of ["s", "m", "l", "full"]) {
          await page.getByRole("button", { name: board, exact: true }).click();
          for (const width of [320, 640, 1024, 1920]) {
            await page.setViewportSize({ width, height: 900 });
            await check(page, `Spectral board=${board}`, touch);
          }
        }
        await page.getByRole("button", { name: "hide", exact: true }).click();
        await check(page, "Spectral controls hidden", touch);
        await page.getByRole("button", { name: "show controls" }).click();
        await page.locator("details").evaluate(el => el.open = true);
        assert.equal(await page.getByRole("button", { name: "full", exact: true }).getAttribute("aria-pressed"), "true");
      }
      if (path === "/contact") {
        const send = page.getByRole("button", { name: "Send message" });
        await page.getByLabel("Name", { exact: true }).fill("   ");
        await page.getByLabel("Email", { exact: true }).fill("alex@example.com");
        await page.getByLabel("Message", { exact: true }).fill(longText);
        await send.click();
        await page.getByText("Enter your name.", { exact: true }).waitFor();
        assert.equal(await page.locator("#contact-name").evaluate(el => el === document.activeElement), true);
        assert.equal(submissions.length, 0);
        await page.getByLabel("Name", { exact: true }).fill("Álex");
        await send.click();
        await page.getByRole("status").last().getByText("service unavailable").waitFor();
        assert.equal(await page.locator("#contact-message").inputValue(), longText);
        contactState = "network";
        await send.click();
        await page.getByRole("status").last().getByText(/We could not confirm receipt/).waitFor();
        assert.equal(submissions[0].submissionId, submissions[1].submissionId);
        contactState = "invalid";
        await send.click();
        await page.getByRole("status").getByText(/We could not confirm receipt/).waitFor();
        assert.equal(submissions[0].submissionId, submissions[2].submissionId);
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await check(page, "Contact retained draft and error", touch);
        }
        contactState = "accepted";
        await page.locator("#contact-message").fill(longText + " Updated.");
        await send.click();
        await page.getByText("Your message has been received for delivery.", { exact: true }).waitFor();
        assert.notEqual(submissions[0].submissionId, submissions[3].submissionId);
        assert.equal(await page.locator("#contact-message").inputValue(), "");
        assert.equal(await page.getByRole("status").evaluate(el => el === document.activeElement), true);
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await check(page, "Contact accepted", touch);
        }
      }
    }
    for (state of process.argv.includes("--contact") ? [] : ["loading", "error"]) {
      await page.goto(baseURL + "/music", { waitUntil: "domcontentloaded" });
      await page.locator("astro-island:not([ssr])").first().waitFor({ state: "attached" });
      if (state === "loading") await page.locator('[aria-busy="true"]').waitFor();
      if (state === "error") await page.getByRole("button", { name: "retry" }).first().waitFor();
      for (const width of [320, 1024, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await check(page, `Music ${state}`, touch);
      }
    }
    await context.close();
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(failures.length, 0, JSON.stringify(failures, null, 2));
  console.log(`PASS: ${checks} responsive checks across ${routes.length} routes, touch and mouse, populated and error states.`);
} finally {
  await browser.close();
}
