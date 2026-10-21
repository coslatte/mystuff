import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
});
try {
  for (const viewport of [{ width: 320, height: 740 }, { width: 1440, height: 1000 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://convchain.test/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const file = path.includes(".") ? path : `${path.replace(/\/$/, "")}/index.html`;
      const contentType = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".txt") ? "text/plain" : "text/html";
      await route.fulfill({ body: await readFile(`dist/client${file}`), contentType });
    });
    await page.route(/fonts\.google/, route => route.abort());
    await page.goto("https://convchain.test/experimentation/convchain");
    await page.locator("astro-island:not([ssr])").waitFor({ state: "attached" });
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-boot-pending"));
    const canvas = page.locator("[data-conv-chain] canvas");
    const pixels = () => canvas.evaluate(element => element.toDataURL());
    const progress = page.locator("[data-conv-chain-progress]");
    assert.match(await progress.innerText(), /^0\.0 sweeps/, "Reduced motion starts paused");
    await page.getByRole("button", { name: "reset", exact: true }).click();
    const initial = await pixels();
    await page.getByRole("button", { name: "One sweep", exact: true }).click();
    const evolved = await pixels();
    assert.notEqual(evolved, initial, "A sweep changes the bitmap");
    await page.getByRole("button", { name: "reset", exact: true }).click();
    assert.equal(await pixels(), initial, "Reset restores the seeded starting field");
    await page.getByRole("button", { name: "One sweep", exact: true }).click();
    assert.equal(await pixels(), evolved, "A repeated seeded sweep reproduces the image");

    const samplePixel = page.locator("[data-conv-chain] [role=group] button").first();
    const wasOn = await samplePixel.getAttribute("aria-pressed");
    await samplePixel.click();
    assert.notEqual(await samplePixel.getAttribute("aria-pressed"), wasOn);
    assert.equal(await page.getByRole("combobox", { name: "presets", exact: true }).inputValue(), "custom");
    assert.match(await progress.innerText(), /^0\.0 sweeps/, "Editing resets the model");
    await page.getByRole("combobox", { name: "presets", exact: true }).selectOption("1");
    for (const n of ["2", "3", "4"]) {
      await page.getByRole("combobox", { name: "Pattern size", exact: true }).selectOption(n);
      await page.getByRole("button", { name: "One sweep", exact: true }).click();
      assert.match(await progress.innerText(), /^1\.0 sweeps/, `Pattern ${n} completes a sweep`);
    }
    await page.getByRole("checkbox", { name: "Rotations and reflections", exact: true }).uncheck();
    await page.getByRole("slider", { name: /Output size/ }).focus();
    await page.keyboard.press("Home");
    assert.equal(await canvas.getAttribute("width"), "16");
    await page.getByRole("checkbox", { name: /Tile preview/ }).check();
    assert.equal(await canvas.getAttribute("width"), "32");
    await page.getByRole("checkbox", { name: /Tile preview/ }).uncheck();
    await page.getByRole("slider", { name: /iterations/ }).focus();
    await page.keyboard.press("Home");
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
    await page.getByRole("button", { name: "Run", exact: true }).waitFor();
    assert.match(await progress.innerText(), /^1\.0 sweeps/, "Automatic run stops at the selected target");
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG", exact: true }).click();
    const download = await downloadEvent;
    assert.match(download.suggestedFilename(), /^convchain-7-16\.png$/);
    assert.equal(await download.failure(), null);

    const source = page.locator('[data-experiment-credits] a[href="https://github.com/mxgmn/ConvChain"]');
    assert.equal(await source.count(), 1);
    for (const [locale, runLabel, creditTitle] of [
      ["es", "Ejecutar", "Hecho con código abierto"],
      ["fr", "Lancer", "Créé avec des logiciels libres"],
      ["de", "Starten", "Mit Open Source erstellt"],
      ["ja", "実行", "オープンソースを使用"],
      ["en", "Run", "Built with open source"],
    ]) {
      await page.locator("[data-language-select]").selectOption(locale);
      await page.getByRole("button", { name: runLabel, exact: true }).waitFor();
      assert.equal(await page.locator("[data-experiment-credits] h2").textContent(), creditTitle);
      assert.ok(!/\{[xy]\}/.test(await samplePixel.getAttribute("aria-label") ?? ""), "Pixel parameters are translated");
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await page.locator("astro-island:not([ssr])").waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
    await page.waitForTimeout(1000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Run", exact: true }).waitFor();
    const paused = await progress.innerText();
    await page.waitForTimeout(200);
    assert.equal(await progress.innerText(), paused, "Reduced motion changes pause automatic generation");
    await page.evaluate(() => scrollTo(0, 0));
    await mkdir("dist/checks", { recursive: true });
    await page.screenshot({ path: `dist/checks/convchain-${viewport.width}.png`, fullPage: true });
    await page.screenshot({ path: `dist/checks/convchain-viewport-${viewport.width}.png` });

    await page.goto("https://convchain.test/experimentation");
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-boot-pending"));
    for (const href of ["https://github.com/rvanwijnen/spectral.js", "https://bencho.dev", "https://github.com/mxgmn/ConvChain"]) {
      assert.equal(await page.locator(`[data-experiment-credits] a[href="${href}"]`).count(), 1);
    }
    assert.equal(await page.locator('a[href="/experimentation/convchain"]').count(), 1);
    for (const [slug, href] of [["spectral", "https://github.com/rvanwijnen/spectral.js"], ["subdivision", "https://github.com/rvanwijnen/spectral.js"], ["heat-map", "https://bencho.dev"]]) {
      await page.goto(`https://convchain.test/experimentation/${slug}`);
      assert.equal(await page.locator(`[data-experiment-credits] a[href="${href}"]`).count(), 1, `${slug} source credit`);
    }
    assert.deepEqual(errors, [], "No browser errors");
    await page.close();
  }
  console.log("PASS: ConvChain rendering, seeded steps, editor, N=2..4, controls, tiles, PNG, five locales, source credits and mobile layout.");
} finally {
  await browser.close();
}
