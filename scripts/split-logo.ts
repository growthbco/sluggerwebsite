import sharp from "sharp";

// Separate the stacked wordmark into words via connected components on the
// alpha channel, then bucket components by centroid row.
async function main() {
  const { data, info } = await sharp("public/slugger-logo.png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const label = new Int32Array(W * H).fill(-1);
  const alphaAt = (x: number, y: number) => data[(y * W + x) * 4 + 3];
  let next = 0;
  const comps: { minX: number; maxX: number; minY: number; maxY: number; count: number; sumY: number }[] = [];
  const stack: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (label[i] !== -1 || alphaAt(x, y) < 10) continue;
      const c = { minX: x, maxX: x, minY: y, maxY: y, count: 0, sumY: 0 };
      stack.push(i);
      label[i] = next;
      while (stack.length) {
        const p = stack.pop()!;
        const px = p % W, py = (p / W) | 0;
        c.count++; c.sumY += py;
        if (px < c.minX) c.minX = px; if (px > c.maxX) c.maxX = px;
        if (py < c.minY) c.minY = py; if (py > c.maxY) c.maxY = py;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (label[ni] === -1 && alphaAt(nx, ny) >= 10) { label[ni] = next; stack.push(ni); }
        }
      }
      comps.push(c);
      next++;
    }
  }
  comps.forEach((c, i) => {
    if (c.count > 500) console.log(`comp ${i}: count=${c.count} x=[${c.minX},${c.maxX}] y=[${c.minY},${c.maxY}] cy=${Math.round(c.sumY / c.count)}`);
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
