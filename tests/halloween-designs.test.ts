import { test } from "node:test";
import assert from "node:assert/strict";
import { HALLOWEEN_DESIGNS, resolveHalloweenConcept, halloweenDesignUrl, withHalloweenContext } from "../src/lib/halloween-designs";
import { readFileSync, existsSync } from "node:fs";

test("Halloween concepts are whitelisted and carried into the existing designer brief", () => {
  for (const concept of ["neon-halloween", "original"] as const) {
    const url = new URL(halloweenDesignUrl(concept), "https://test.invalid");
    assert.equal(resolveHalloweenConcept(url.searchParams.get("campaign"), url.searchParams.get("concept")), concept);
    const brief = withHalloweenContext(concept, "Purple and orange. Event October 24.");
    assert.ok(brief.includes(HALLOWEEN_DESIGNS[concept].title));
    assert.ok(brief.includes("Event October 24."));
  }
  for (const value of ["__proto__", "constructor", "https://untrusted.invalid/image.png", "", ["original"]]) {
    assert.equal(resolveHalloweenConcept("halloween", value), undefined);
  }
  assert.equal(resolveHalloweenConcept("other", "original"), undefined);
  assert.equal(withHalloweenContext(undefined, "Normal request"), "Normal request");
  assert.match(withHalloweenContext("neon-halloween", "New description"), /NeonHalloweenTransparentJerseyFront.png/);
});

test("example assets exist and the form submits the campaign context", () => {
  for (const side of ["Front", "Back"]) assert.ok(existsSync(`public/media/NeonHalloweenTransparentJersey${side}.png`));
  const form = readFileSync("src/components/design-intake-form.tsx", "utf8");
  assert.ok(form.includes("vision: withHalloweenContext(halloweenConcept, vision)"));
  assert.ok(form.includes('fetch("/api/design-request/create"'));
  assert.ok(readFileSync("src/app/sitemap.ts", "utf8").includes('"/halloween-jerseys"'));
});
