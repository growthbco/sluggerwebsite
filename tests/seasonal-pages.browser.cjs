/* Run against a local preview only. All API writes are blocked; design
 * submissions are intercepted and inspected, never sent to the server.
 * PLAYWRIGHT_MODULE may point at an existing Playwright installation.
 * Optional BROWSER_EXECUTABLE selects an installed Chromium binary.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser harness loads an optional external Playwright installation. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:3186";
const origin = new URL(base);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname), "Only test a local preview");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const failures = [];
  try {
    const context = await browser.newContext();
    let submitted;
    await context.route("**/api/**", async (route) => {
      if (route.request().method() === "GET") return route.continue();
      if (new URL(route.request().url()).pathname === "/api/design-request/create") {
        submitted = route.request().postDataJSON();
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ statusUrl: "/design/status/local-test-only" }) });
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(error.message));
    for (const campaign of ["halloween", "christmas"]) {
      for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
        // Resize a blank page so the previous page cannot start image requests
        // that navigation would immediately cancel in the local optimizer.
        await page.goto("about:blank");
        await page.setViewportSize({ width, height: 844 });
        const response = await page.goto(`${base}/${campaign}-jerseys`, { waitUntil: "domcontentloaded" });
        assert.equal(response.status(), 200);
        await page.evaluate(() => document.fonts.ready);
        // Eager-load below-fold examples to verify every image, not just the hero.
        await page.locator("main img").evaluateAll((images) => images.forEach((img) => { img.loading = "eager"; }));
        await page.waitForFunction(() => Array.from(document.querySelectorAll("main img")).every((img) => img.complete && img.naturalWidth > 0), { timeout: 30000 });
        const layout = await page.evaluate(() => {
          const bad = Array.from(document.querySelectorAll("main h1, main h2, main h3, main p, main a")).filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1);
          }).map((el) => el.textContent.slice(0, 80));
          return { width: innerWidth, scroll: document.documentElement.scrollWidth, bad };
        });
        assert.ok(layout.scroll <= width, JSON.stringify({ campaign, width, layout }));
        assert.deepEqual(layout.bad, [], JSON.stringify({ campaign, width, layout }));
        assert.match(await page.locator("#seasonal-pricing").locator("..").locator("..").innerText(), /\$28/);
        assert.match(await page.locator("#seasonal-pricing").locator("..").locator("..").innerText(), /\$35/);
        const cta = page.locator(`main a[href="/design?campaign=${campaign}&concept=original"]`).first();
        const box = await cta.boundingBox();
        assert.ok(box.height >= 44);
        if (width < 640) assert.ok(box.width >= width - 40, `Full-width mobile CTA: ${campaign} ${width}`);
        if (process.env.SCREENSHOT_DIR && [390, 1440].includes(width)) {
          await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${campaign}-${width}.png`, fullPage: true });
          await page.locator("main section").first().screenshot({ path: `${process.env.SCREENSHOT_DIR}/${campaign}-hero-${width}.png` });
          await page.locator('section[aria-labelledby="seasonal-pricing"]').screenshot({ path: `${process.env.SCREENSHOT_DIR}/${campaign}-pricing-${width}.png` });
        }
        console.log(`PASS ${campaign}: ${width}px, images loaded, no overflow, pricing and CTA`);
      }
    }
    for (const [campaign, concept] of [
      ["christmas", "christmas-crewneck"], ["christmas", "christmas-long-sleeve"], ["christmas", "original"],
      ["halloween", "neon-halloween"], ["halloween", "mamba-halloween-black"], ["halloween", "mamba-halloween-white"], ["halloween", "original"],
    ]) {
      await page.goto("about:blank");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${base}/${campaign}-jerseys`, { waitUntil: "domcontentloaded" });
      await page.locator(`main a[href="/design?campaign=${campaign}&concept=${concept}"]`).first().click();
      await page.locator("form aside").waitFor();
      assert.match(await page.locator("form aside").innerText(), new RegExp(campaign, "i"));
      assert.equal(await page.locator("#design-sport").inputValue(), "");
      assert.equal(await page.locator("#design-jersey-style").inputValue(), "");
      await page.locator("#design-team-name").fill("Local seasonal QA — not a real request");
      await page.locator("#design-contact-name").fill("Preview Test");
      await page.locator("#design-contact-email").fill("seasonal-test@example.invalid");
      await page.locator("#design-sport").fill("Bowling");
      await page.locator("#design-jersey-style").selectOption("Bowling Shirt (Camp Collar)");
      await page.getByRole("button", { name: /15-24 pieces/ }).click();
      await page.locator("#design-vision").fill("Blue and silver. Event December 12.");
      await page.locator("#design-delivery-timing-ack").check();
      submitted = undefined;
      await page.getByRole("button", { name: "Submit Design Request" }).click();
      await page.getByRole("heading", { name: "Design request received!" }).waitFor();
      assert.ok(submitted);
      assert.equal(submitted.sport, "Bowling");
      assert.equal(submitted.jerseyStyle, "Bowling Shirt (Camp Collar)");
      assert.deepEqual(submitted.productTypes, ["Jersey / Shirt"]);
      assert.match(submitted.vision, new RegExp(`${campaign} campaign`, "i"));
      assert.ok(submitted.vision.includes("Blue and silver. Event December 12."));
      assert.ok(submitted.vision.includes(concept === "original" ? "Original concept requested." : "Example: https://"));
      console.log(`PASS ${campaign}/${concept}: CTA → form → mocked submission, editable sport and retained example`);
    }
    await page.goto(`${base}/design?sport=Bowling`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("#design-sport").inputValue(), "Bowling");
    assert.equal(await page.locator("form aside").count(), 0);
    assert.equal(await page.locator("#design-vision").inputValue(), "");
    assert.deepEqual(failures, [], "No browser runtime errors");
    console.log("PASS ordinary design flow unchanged; no browser runtime errors; no API writes sent");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
