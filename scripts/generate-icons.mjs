/* ═══════════════════════════════════════════════════════════════════════
   Generates the PWA icon set from the app's own launcher icon.

   Run with `npm run icons`. Checked-in output lives in public/icons, so a
   normal build does not need sharp.

   Every icon is the mark in white on the brand blue. The artwork itself is
   blue, and the first version of this script put it on a blue ground as-is:
   the installed app was a plain blue square. Only the artwork's shape is
   used here, so it cannot blend into its own tile again.

   Three families, because the platforms genuinely differ:

   * `any` icons are a rounded brand tile with transparent corners, used in
     the browser tab, the desktop install and Android's legacy path.
   * `maskable` icons are full-bleed brand with the mark inside the safe
     zone, because Android crops an adaptive icon to whatever shape the
     launcher uses — a mark near the edge loses its edges.
   * `apple-touch-icon` is full-bleed too. iOS rounds the corners itself and
     composites nothing: a transparent PNG there renders on black.
   ═══════════════════════════════════════════════════════════════════════ */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const source = resolve(root, 'public/assets/icon.png')
const outDir = resolve(root, 'public/icons')

/** The logo azure, matching --color-brand. */
const BRAND = { r: 0x1f, g: 0x77, b: 0xf1, alpha: 1 }
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

const ANY_SIZES = [48, 72, 96, 128, 144, 192, 256, 384, 512]
const MASKABLE_SIZES = [192, 512]
/** iOS reads 180 for the Home Screen; the rest cover older devices. */
const APPLE_SIZES = [120, 152, 167, 180]

/**
 * The mark alone, in white, `height` pixels tall.
 *
 * The source canvas carries uneven padding (the mark sits low and to one
 * side), so it is trimmed to the ink and then centred by the caller, rather
 * than inheriting the artwork's offset.
 */
async function whiteMark(height) {
  const alpha = await sharp(source)
    .trim()
    .resize({ height, fit: 'inside' })
    .ensureAlpha()
    .extractChannel(3)
    .png()
    .toBuffer()
  const { width } = await sharp(alpha).metadata()
  const art = await sharp({ create: { width, height, channels: 3, background: WHITE } })
    .joinChannel(alpha)
    .png()
    .toBuffer()
  return { art, width, height }
}

/** A brand ground of `size` with the mark centred at `scale` of its height. */
async function tile(size, scale, radius) {
  const mark = await whiteMark(Math.round(size * scale))
  const ground =
    radius > 0
      ? Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
            `<rect width="${size}" height="${size}" rx="${size * radius}" fill="#1F77F1"/></svg>`,
        )
      : { create: { width: size, height: size, channels: 4, background: BRAND } }
  return sharp(ground)
    .composite([
      {
        input: mark.art,
        top: Math.round((size - mark.height) / 2),
        left: Math.round((size - mark.width) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** Rounded tile, transparent corners. */
const any = (size) => tile(size, size <= 32 ? 0.66 : 0.56, 0.22)

/**
 * Maskable icons must keep their meaning inside a circle of 80% of the
 * canvas. At 46% of the height the mark's bounding box stays well inside it.
 */
const maskable = (size) => tile(size, 0.46, 0)

const apple = (size) => tile(size, 0.54, 0)

async function main() {
  await mkdir(outDir, { recursive: true })

  for (const size of ANY_SIZES) {
    await writeFile(resolve(outDir, `icon-${size}.png`), await any(size))
  }
  for (const size of MASKABLE_SIZES) {
    await writeFile(resolve(outDir, `maskable-${size}.png`), await maskable(size))
  }
  for (const size of APPLE_SIZES) {
    await writeFile(resolve(outDir, `apple-touch-icon-${size}.png`), await apple(size))
  }
  // The default iOS looks for when no size is specified.
  await writeFile(resolve(root, 'public/apple-touch-icon.png'), await apple(180))
  await writeFile(resolve(root, 'public/favicon-32.png'), await any(32))
  await writeFile(resolve(root, 'public/favicon-16.png'), await any(16))

  console.log(
    `Wrote ${ANY_SIZES.length + MASKABLE_SIZES.length + APPLE_SIZES.length + 3} icons to public/`,
  )
}

await main()
