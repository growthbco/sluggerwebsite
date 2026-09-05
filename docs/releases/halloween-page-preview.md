# Halloween page — local review

Branch: codex/halloween-page. Based on the production Rush release 1323955.
Do not deploy without Gary's approval.

Includes /halloween-jerseys, existing front/back examples, original-design and
example-design links, homepage and softball/baseball links, SEO metadata, and
sitemap entry. The Design Center receives a whitelisted concept and keeps that
reference in the existing vision field sent to the existing design-request API.
Sport is not forced. Camp-collar bowling remains an available style.

No new order system, checkout, database schema, discounts, or delivery guarantees.
The existing example images contain recognizable horror characters; have Gary
approve the final imagery before publication. No licensing relationship is claimed.

Checks: local build, TypeScript, two campaign tests and seven Rush regression tests.
New-page/helper lint passed. Full real request submission was not exercised because
it would create a customer workflow and notifications. Browser visual verification
and final desktop/mobile review remain required before publication.

Local preview command: npm run start -- --port 3186
URL: http://127.0.0.1:3186/halloween-jerseys
