import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const output = process.env.SCREENSHOT_DIR;
const widths = [320, 375, 390, 639, 640, 768, 1023, 1024, 1280, 1599, 1600, 1920];
const viewports = widths.map(width => ({ width, height: 900 }));
viewports.push({ width: 844, height: 390 }, { width: 568, height: 320 });
const routes = ["/", "/coding", "/music", "/experimentation", "/experimentation/spectral", "/experimentation/subdivision", "/admin", "/loading", "/contact"];
const longText = "LongUnbrokenContent".repeat(12);
const song = { id: 1, title: longText, artist: longText, duration: "3:24", createdAt: "2026-01-01T00:00:00Z", audioUrl: `${baseURL}/responsive-audio.wav`, avgRating: 4.5, totalVotes: 1234 };
const album = { id: "responsive", title: longText, trackCount: 12, setType: "album", releaseDate: "2026-01-01", url: "https://soundcloud.com/example/sets/responsive" };
const comment = { id: 1, songId: 1, author: longText, content: longText, createdAt: "2026-01-01T00:00:00Z" };
const browser = await chromium.launch({
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
});
if (process.argv.includes("--loading")) {
  try {
    await checkLoading();
  } finally {
    await browser.close();
  }
  process.exit(0);
}
const failures = [];
let checks = 0;
if (output) await mkdir(output, { recursive: true });

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
    await page.locator('a[href="/"]').first().evaluate(link => link.click());
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
      await page.goto(baseURL + path, { waitUntil: "domcontentloaded" });
      // Attached, not visible: the bar only shows once a source has something to
      // report, so on a route with no playback the widget stays hidden.
      await page.locator("now-playing-el > div").waitFor({ state: "attached" });
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      if (path === "/music") {
        await page.getByRole("button", { name: "comments ▼" }).click();
        await page.getByText(longText, { exact: true }).last().waitFor();
        await page.getByRole("button", { name: /LongUnbrokenContent/ }).click();
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
    for (state of ["loading", "error"]) {
      await page.goto(baseURL + "/music", { waitUntil: "domcontentloaded" });
      await page.locator("astro-island:not([ssr])").first().waitFor();
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
