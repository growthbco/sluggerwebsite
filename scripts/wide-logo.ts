import sharp from "sharp";

// Split the stacked wordmark into its two lines, then lay them side by side.
async function main() {
  const src = "public/slugger-logo.png";
  const meta = await sharp(src).metadata();
  console.log("src:", meta.width, "x", meta.height);
  // Line 1 "Slugger" roughly top half, line 2 "Athletics" bottom half.
  await sharp(src).extract({ left: 0, top: 0, width: 1000, height: 330 }).trim().toFile("/tmp/line1.png");
  await sharp(src).extract({ left: 0, top: 300, width: 1000, height: 323 }).trim().toFile("/tmp/line2.png");
  const m1 = await sharp("/tmp/line1.png").metadata();
  const m2 = await sharp("/tmp/line2.png").metadata();
  console.log("line1:", m1.width, "x", m1.height, "| line2:", m2.width, "x", m2.height);
}
main().catch((e) => { console.error(e); process.exit(1); });
