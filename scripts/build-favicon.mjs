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

// The brand mark is designed black + gold on white. We preserve that look:
// trim the source's outer white border, then place the trimmed mark onto a
// fresh white square with a touch of padding so it reads cleanly at 16×16.
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function buildMark(size) {
  // Padding around the mark inside the square. Tiny sizes need more breathing
  // room so the strokes don't crash into the edge; larger sizes can fill more.
  const pad = size <= 16 ? 0.06 : size <= 32 ? 0.05 : 0.07;
  const inner = Math.round(size * (1 - pad * 2));

  const trimmed = await sharp(SRC)
    .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 12 })
    .resize(inner, inner, { fit: "contain", background: BG })
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: trimmed, gravity: "center" }])
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
