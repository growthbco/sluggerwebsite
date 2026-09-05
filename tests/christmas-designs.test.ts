import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { CHRISTMAS_DESIGNS, christmasDesignUrl, resolveChristmasConcept, withChristmasContext } from "../src/lib/christmas-designs";
import { resolveHalloweenConcept, withHalloweenContext } from "../src/lib/halloween-designs";
import { jerseyPriceCents } from "../src/lib/team-order-pricing";

test("Christmas examples round-trip into the designer brief without changing ordinary or Halloween requests", () => {
  for (const concept of ["christmas-crewneck", "christmas-long-sleeve", "original"] as const) {
    const url = new URL(christmasDesignUrl(concept), "https://test.invalid");
    assert.equal(resolveChristmasConcept(url.searchParams.get("campaign"), url.searchParams.get("concept")), concept);
    assert.equal(resolveHalloweenConcept("christmas", concept), undefined);
    const design = CHRISTMAS_DESIGNS[concept];
    const brief = withChristmasContext(concept, withHalloweenContext(undefined, "Blue and silver. Event December 12."));
    assert.ok(brief.includes(design.title));
    assert.ok(brief.includes("Event December 12."));
    if (design.reference) {
      assert.ok(existsSync(`public${design.reference}`));
      assert.ok(brief.includes(`https://sluggerathletics.com${design.reference}`));
    }
  }
  for (const bad of ["__proto__", "constructor", "", ["original"], "https://bad.invalid/x"]) assert.equal(resolveChristmasConcept("christmas", bad), undefined);
  assert.equal(resolveChristmasConcept("halloween", "original"), undefined);
  assert.equal(withChristmasContext(undefined, "Ordinary request"), "Ordinary request");
  assert.equal(withChristmasContext(undefined, withHalloweenContext("original", "Orange")), withHalloweenContext("original", "Orange"));
});

test("seasonal pages share actual order starting prices and expose Christmas discovery", () => {
  assert.equal(jerseyPriceCents("Standard Crew Neck"), 2800);
  assert.equal(jerseyPriceCents("Full Button"), 3500);
  for (const campaign of ["halloween", "christmas"]) {
    assert.ok(readFileSync(`src/app/${campaign}-jerseys/page.tsx`, "utf8").includes("<SeasonalJerseyPricing />"));
  }
  assert.ok(readFileSync("src/app/sitemap.ts", "utf8").includes('"/christmas-jerseys"'));
  assert.ok(readFileSync("src/app/page.tsx", "utf8").includes('href="/christmas-jerseys"'));
  assert.ok(readFileSync("src/components/design-intake-form.tsx", "utf8").includes("vision: withChristmasContext(christmasConcept, withHalloweenContext(halloweenConcept, vision))"));
});
