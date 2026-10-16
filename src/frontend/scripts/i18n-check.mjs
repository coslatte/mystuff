import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
});
const failures = [];
const errors = [];
let checks = 0;
try {
  const context = await browser.newContext({ locale: "en-US", reducedMotion: "reduce" });
  await context.route(/fonts\.google|api\.github|api\.spotify|soundcloud\.com/, route => route.abort());
  await context.route(/\/api\//, route => route.fulfill({ json: { success: true, data: [] } }));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const locales = ["en", "es", "fr", "de", "ja"];
  const expected = {
    en: { heading: "Send a message", name: "Name", submit: "Send message ↗" },
    es: { heading: "Envía un mensaje", name: "Nombre", submit: "Enviar mensaje ↗" },
    fr: { heading: "Envoyer un message", name: "Nom", submit: "Envoyer le message ↗" },
    de: { heading: "Nachricht senden", name: "Name", submit: "Nachricht senden ↗" },
    ja: { heading: "メッセージを送る", name: "名前", submit: "メッセージを送信 ↗" },
  };
  await page.goto(baseURL + "/contact");
  await page.waitForFunction(() => !document.documentElement.matches("[data-boot-pending], .boot-locked"));
  await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#contact-name")?.disabled === false);
  await page.locator("#contact-name").fill("Language test");
  await page.locator("#contact-message").fill("Draft survives every language change.");
  for (const width of [320, 375, 640, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of locales) {
      await page.locator("[data-language-select]").selectOption(locale);
      await page.waitForFunction(language => document.documentElement.lang === language, locale);
      await page.getByRole("button", { name: expected[locale].submit, exact: true }).waitFor();
      assert.equal((await page.locator("main h1").textContent()).trim(), expected[locale].heading);
      assert.equal((await page.locator('label[for="contact-name"]').textContent()).trim(), expected[locale].name);
      assert.equal(await page.locator("#contact-name").inputValue(), "Language test");
      assert.equal(await page.locator("#contact-message").inputValue(), "Draft survives every language change.");
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      if (dimensions.scroll > width + 1) failures.push(`${locale} /contact ${width}px overflows by ${dimensions.scroll - width}px`);
      const box = await page.locator("[data-language-select]").boundingBox();
      assert.ok(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width);
      checks++;
    }
  }
  const selectorStyle = await page.locator("[data-language-select]").evaluate(node => {
    const style = getComputedStyle(node.parentElement);
    return { radius: style.borderRadius, background: style.backgroundColor, border: style.borderTopWidth };
  });
  assert.equal(selectorStyle.radius, "0px", "The language selector keeps square corners");
  assert.notEqual(selectorStyle.background, "rgba(0, 0, 0, 0)", "The language selector has its own background");
  assert.equal(selectorStyle.border, "2px", "The language selector has a strong border");
  await page.reload();
  await page.getByRole("button", { name: expected.ja.submit, exact: true }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "ja");
  await page.locator('a[href="/experimentation"]').first().click();
  await page.waitForURL(url => url.pathname === "/experimentation" || url.pathname === "/experimentation/");
  await page.getByRole("heading", { name: "実験", exact: true }).waitFor();
  assert.equal(await page.locator("[data-language-select]").inputValue(), "ja");
  for (const route of ["/", "/music", "/experimentation", "/experimentation/spectral", "/experimentation/subdivision"]) {
    await page.goto(baseURL + route);
    await page.locator("[data-language-select]:enabled").waitFor();
    for (const locale of locales) {
      await page.locator("[data-language-select]").selectOption(locale);
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(50);
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
        if (scroll > width + 1) failures.push(`${locale} ${route} ${width}px overflows by ${scroll - width}px`);
        checks++;
      }
    }
  }
  await context.close();
  const detected = await browser.newContext({ locale: "fr-CA" });
  const detectedPage = await detected.newPage();
  await detectedPage.goto(baseURL + "/contact");
  await detectedPage.getByRole("button", { name: expected.fr.submit, exact: true }).waitFor();
  assert.equal(await detectedPage.locator("html").getAttribute("lang"), "fr");
  await detected.close();
  assert.deepEqual(failures, [], "Responsive localization regressions");
  assert.deepEqual(errors, [], "Browser errors, including hydration");
  console.log(`Passed ${checks} language/viewport checks, draft preservation, reload, client navigation, browser-language detection and hydration.`);
} finally {
  await browser.close();
}
