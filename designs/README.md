# Drop your flat jersey designs here

This folder feeds the AI mockup generator (`npm run mockups`).

## How to use

1. Drop your **flat, print-ready design files** here as PNG/JPG.
   - Name each file after the product, e.g. `why-so-serious.png`, `misfits.png`.
   - The filename becomes the mockup's name in `public/mockups/`.
2. (Optional but recommended) Add **`_reference.png`** — one example of the
   exact jersey-mockup style you want every product to match (front + back,
   angled, on white). Files starting with `_` are treated as references, not
   designs.
3. Make sure `GEMINI_API_KEY` is set in `.env.local`
   (get one free at https://aistudio.google.com/apikey).
4. Run: `npm run mockups`

Output lands in `public/mockups/<name>.png` — uniform mockups ready to wire
into the product grid.
