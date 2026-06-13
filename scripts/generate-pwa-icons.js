/**
 * generate-pwa-icons — produces the three PNG sizes the PWA manifest needs.
 *
 * Reads /public/icon.svg (the app's vector logo) and writes:
 *   - public/icon-192.png
 *   - public/icon-512.png
 *   - public/icon-maskable-512.png
 *
 * The maskable variant keeps a 10% safe-area padding on all sides, so
 * Android can crop to circle/squircle/rounded-square without clipping
 * the glyph. Re-run after editing icon.svg.
 */
const sharp = require("sharp");
const path = require("node:path");
const fs = require("node:fs/promises");

const PUBLIC = path.resolve(__dirname, "..", "public");
const SOURCE = path.join(PUBLIC, "icon.svg");

async function rasterize(size, paddingRatio = 0) {
  const svg = await fs.readFile(SOURCE, "utf-8");
  const inner = size - Math.round(size * paddingRatio * 2);
  const offset = Math.round((size - inner) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 22, g: 163, b: 74, alpha: 1 }, // matches theme_color
    },
  })
    .composite([
      {
        input: Buffer.from(svg),
        top: offset,
        left: offset,
        width: inner,
        height: inner,
      },
    ])
    .png()
    .toBuffer();
}

async function main() {
  const source = await fs.readFile(SOURCE, "utf-8").catch(() => null);
  if (!source) throw new Error(`Missing ${SOURCE}`);
  const targets = [
    { file: "icon-192.png", size: 192, padding: 0 },
    { file: "icon-512.png", size: 512, padding: 0 },
    // Maskable: 10% safe area on all sides (Android guidelines).
    { file: "icon-maskable-512.png", size: 512, padding: 0.1 },
  ];
  for (const { file, size, padding } of targets) {
    const out = path.join(PUBLIC, file);
    const buf = await rasterize(size, padding);
    await fs.writeFile(out, buf);
        console.log(
      `✓ ${file} (${size}×${size}${padding ? " maskable" : ""}, ${buf.length} bytes)`
    );
  }
}

main().catch((err) => {
    console.error(`✗ ${err.message ?? err}`);
  process.exit(1);
});
