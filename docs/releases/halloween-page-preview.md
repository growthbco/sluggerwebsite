# Halloween and Christmas pages — local review

Branch: codex/halloween-page. Based on the production Rush release 1323955.
Do not deploy without Gary's approval.

Includes /halloween-jerseys and /christmas-jerseys, existing front/back examples, original-design and
example-design links, homepage and softball/baseball links, SEO metadata, and
sitemap entry. The Design Center receives a whitelisted concept and keeps that
reference in the existing vision field sent to the existing design-request API.
Sport is not forced. Camp-collar bowling remains an available style.

No new order system, checkout, database schema, discounts, or delivery guarantees.
The existing example images contain recognizable horror and Christmas film
characters; have Gary approve the final imagery before publication. No licensing
relationship is claimed. Mamba black and white examples are included with Gary's
approval and do not change the Mamba store.

Both pages share starting prices sourced from team-order pricing: crewneck $28,
full-button $35. Long sleeves are separately quoted. Six-piece minimum, tax,
Standard shipping, and shipping-inclusive Rush terms are visible.

Checks completed September 4, 2026:
- Production build and TypeScript pass; 11 campaign/Rush tests pass.
- New pages, shared pricing, helpers, and browser harness pass targeted lint.
  The existing contact-prefill effect in design-intake-form.tsx still has its
  pre-existing react-hooks/set-state-in-effect lint finding; not changed here.
- Browser checks pass at 320, 375, 390, 430, 768, 1024, and 1440px on both pages:
  images load, no horizontal text/page overflow, starting prices visible, and
  full-width 44px+ CTAs on mobile. Desktop and phone screenshots reviewed.
- All seven campaign CTAs reach the existing form; editable sport/style and
  example context survive a rewritten brief through intercepted submissions.
  Normal /design?sport=Bowling remains unchanged. No browser runtime errors.
- Browser API writes are blocked; design submissions use a mock response.
  No real customer requests, notifications, or orders were created.

The local image optimizer stalled after rapid viewport resize followed by
navigation canceled in-flight image requests. Restarting the preview and sizing
a blank page before navigation resolved the test. No image pipeline changes.

Browser regression: tests/seasonal-pages.browser.cjs. Use PLAYWRIGHT_MODULE for
an existing Playwright installation and BROWSER_EXECUTABLE for its Chromium,
with optional SCREENSHOT_DIR. Only localhost previews are allowed by the harness.
Gary's final content/imagery approval and deployment approval remain required.

Local preview command: npm run start -- --port 3186
URL: http://127.0.0.1:3186/halloween-jerseys
URL: http://127.0.0.1:3186/christmas-jerseys
