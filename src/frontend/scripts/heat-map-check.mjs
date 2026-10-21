import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
});
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({ viewport: { width: 320, height: 740 }, reducedMotion });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://heat-map.test/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const file = path.includes(".") ? path : `${path.replace(/\/$/, "")}/index.html`;
      const contentType = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html";
      await route.fulfill({ body: await readFile(`dist/client${file}`), contentType });
    });
    await page.route(/fonts\.google/, route => route.abort());
    await page.goto("https://heat-map.test/experimentation/heat-map");
    await page.locator("astro-island:not([ssr])").waitFor({ state: "attached" });
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-boot-pending"));
    const button = page.locator("button.heat");
    const pixels = () => page.locator(".heat-canvas").evaluate(canvas => {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context unavailable");
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let visible = 0, colorful = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 20) continue;
        visible++;
        if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 20) colorful++;
      }
      return { visible, colorful };
    });
    await page.waitForTimeout(1300);
    assert.ok((await pixels()).visible > 100, "Shape renders at rest");
    assert.equal((await pixels()).colorful, 0, "Shape starts grey");
    await button.hover();
    await page.waitForTimeout(1400);
    assert.ok((await pixels()).colorful > 100, "Pointer reveals heat colors");
    await page.mouse.move(0, 0);
    await button.evaluate(element => element.blur());
    await page.waitForTimeout(1600);
    assert.equal((await pixels()).colorful, 0, "Pointer exit restores grey");
    await button.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1100);
    assert.match(await button.getAttribute("aria-label") ?? "", /Asterisk/);
    assert.ok((await pixels()).visible > 100, "Asterisk renders");
    await page.keyboard.press("Space");
    await page.waitForTimeout(1100);
    assert.match(await button.getAttribute("aria-label") ?? "", /BEND/);
    assert.ok((await pixels()).visible > 100, "Word renders with fallback font");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1100);
    assert.match(await button.getAttribute("aria-label") ?? "", /Dots/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No mobile overflow");
    assert.deepEqual(errors, [], "No browser errors");
    await page.close();
  }
  console.log("PASS: heat-map pixels, pointer fade, keyboard shape cycle, reduced motion and mobile width.");
} finally {
  await browser.close();
}
