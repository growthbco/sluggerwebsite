// Builds favicon assets from the Slugger "SA" monogram.
//
// Outputs:
//   src/app/favicon.ico   — 16/32/48 multi-size ICO (PNG payloads)
//   src/app/icon.png      — 32×32 (modern browsers)
//   src/app/apple-icon.png — 180×180 (iOS home screen)
//
// The monogram sits on a white background in the source; we trim that off,
// drop the mark onto the brand's ink background (#13160b), and export the
// sizes browsers ask for.
//
// Run with: node scripts/build-favicon.mjs

import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public", "sa-monogram.jpg");

// Alpha-key the white background. A simple greyscale->alpha pass would ghost
// the brand-gold (it's a mid-luminance color); instead we key alpha by each
// pixel's distance from white across all channels, scaled so even the gold
// (#b8a36c, min channel ≈ 108) lands fully opaque.
async function knockoutWhite(srcBuffer) {
  const { data, info } = await sharp(srcBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    out[j] = r;
    out[j + 1] = g;
    out[j + 2] = b;
    // 255 - min(r,g,b) is the most-saturated channel's darkness; ×2 makes any
    // pixel with even one channel <= 127 fully opaque (covers black + gold),
    // while pure white stays at 0.
    const minC = Math.min(r, g, b);
    out[j + 3] = Math.min(255, (255 - minC) * 2);
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function buildMark(size) {
  // Padding around the mark inside the square. Tiny sizes need more breathing
  // room so the strokes don't crash into the edge; larger sizes can fill more.
  const pad = size <= 16 ? 0.06 : size <= 32 ? 0.05 : 0.07;
  const inner = Math.round(size * (1 - pad * 2));

  // 1) trim the white border, 2) knock the white out to transparent,
  // 3) fit the mark into the inner box.
  const trimmed = await sharp(SRC)
    .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 12 })
    .toBuffer();

  const keyed = await knockoutWhite(trimmed);

  const mark = await sharp(keyed)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Transparent square canvas — browsers show the tab background through it.
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

// Pack PNG buffers into a single multi-size ICO container.
// Spec: https://en.wikipedia.org/wiki/ICO_(file_format)
function buildIco(frames /* [{size, png}] */) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(frames.length, 4);

  const dir = Buffer.alloc(16 * frames.length);
  let offset = 6 + 16 * frames.length;
  frames.forEach((f, i) => {
    const o = i * 16;
    // size 256 is encoded as 0 in the byte fields.
    dir.writeUInt8(f.size >= 256 ? 0 : f.size, o + 0); // width
    dir.writeUInt8(f.size >= 256 ? 0 : f.size, o + 1); // height
    dir.writeUInt8(0, o + 2); // colors (0 = >=256)
    dir.writeUInt8(0, o + 3); // reserved
    dir.writeUInt16LE(1, o + 4); // color planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(f.png.length, o + 8); // image size
    dir.writeUInt32LE(offset, o + 12); // image offset
    offset += f.png.length;
  });

  return Buffer.concat([header, dir, ...frames.map((f) => f.png)]);
}

async function main() {
  const sizes = [16, 32, 48];
  const frames = await Promise.all(
    sizes.map(async (size) => ({ size, png: await buildMark(size) })),
  );

  const ico = buildIco(frames);
  await writeFile(path.join(ROOT, "src/app/favicon.ico"), ico);

  // Modern browsers + iOS.
  await writeFile(path.join(ROOT, "src/app/icon.png"), frames[1].png); // 32×32
  await writeFile(path.join(ROOT, "src/app/apple-icon.png"), await buildMark(180));

  console.log("✓ favicon.ico (16/32/48) + icon.png (32) + apple-icon.png (180)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
