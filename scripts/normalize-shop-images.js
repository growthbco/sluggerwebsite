// Normalize shop card images so every product sits centered on a white
// square canvas with the same margin. Fixes baked-in letterbox bars, mixed
// aspect ratios, and zoom variance across the AI mockups.
//
// Usage: node scripts/normalize-shop-images.js
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_SIZE = 1024; // final square canvas
const MARGIN = 0.09; // 9% breathing room per side
const TRIM_THRESHOLD = 35;

function collectTargets() {
  const targets = [];
  const mockupDir = path.join(ROOT, "public/mockups");
  for (const f of fs.readdirSync(mockupDir)) {
    if (/\.(png|jpe?g|webp)$/i.test(f)) targets.push(path.join(mockupDir, f));
  }
  // Products without AI mockups surface their original images on cards.
  for (const rel of [
    "public/products/2388/3c2d8942501f.png",
    "public/products/1537/9541b218cc25.png",
    "public/products/1537/30f8561b3f0e.png",
    "public/products/2004/b53d8d7d75cc.png",
    "public/products/2004/882fc606179f.jpg",
    "public/products/2004/9fb32ab36baf.jpg",
    "public/products/2004/22cfb68ca133.jpg",
    "public/products/2004/013e7689d341.png",
  ]) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) targets.push(p);
  }
  return targets;
}

async function normalize(file) {
  const flat = await sharp(file)
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();

  // Repeated trims peel letterbox bars first, then leftover white margins,
  // then re-anchor on gradient backdrops.
  let buf = flat;
  for (let pass = 0; pass < 3; pass++) {
    try {
      const trimmed = await sharp(buf)
        .trim({ threshold: TRIM_THRESHOLD })
        .png()
        .toBuffer();
      const meta = await sharp(trimmed).metadata();
      if (meta.width < 40 || meta.height < 40) break; // trim went too far
      buf = trimmed;
    } catch {
      break; // nothing left to trim
    }
  }

  const meta = await sharp(buf).metadata();
  const inner = Math.round(OUT_SIZE * (1 - MARGIN * 2));
  const resized = await sharp(buf)
    .resize(inner, inner, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  const rMeta = await sharp(resized).metadata();

  const left = Math.round((OUT_SIZE - rMeta.width) / 2);
  const top = Math.round((OUT_SIZE - rMeta.height) / 2);

  let out = sharp(resized).extend({
    top,
    bottom: OUT_SIZE - rMeta.height - top,
    left,
    right: OUT_SIZE - rMeta.width - left,
    background: "#ffffff",
  });

  const ext = path.extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") out = out.jpeg({ quality: 90 });
  else if (ext === ".webp") out = out.webp({ quality: 90 });
  else out = out.png();

  const tmp = file + ".tmp";
  await out.toFile(tmp);
  fs.renameSync(tmp, file);
  return { file: path.relative(ROOT, file), trimmedTo: `${meta.width}x${meta.height}` };
}

(async () => {
  const targets = collectTargets();
  console.log(`Normalizing ${targets.length} images...`);
  for (const t of targets) {
    try {
      const r = await normalize(t);
      console.log(`ok  ${r.file}  (content ${r.trimmedTo})`);
    } catch (e) {
      console.error(`FAIL ${path.relative(ROOT, t)}: ${e.message}`);
    }
  }
})();
