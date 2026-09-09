/* ═══════════════════════════════════════════════════════════════════════
   Generates the PWA icon set from the app's own launcher icon.

   Run with `npm run icons`. Checked-in output lives in public/icons, so a
   normal build does not need sharp.

   Three families, because the platforms genuinely differ:

   * `any` icons are the plain artwork, used in the Android launcher's legacy
     path and in the browser tab.
   * `maskable` icons are the same artwork inset into a safe zone on a solid
     brand ground, because Android crops an adaptive icon to whatever shape
     the launcher uses — a full-bleed logo loses its edges.
   * `apple-touch-icon` is flattened onto white. iOS composites nothing: a
     transparent PNG there renders with a black background.
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

async function any(size) {
  return sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * Maskable icons must keep their meaning inside a circle of 80% of the
 * canvas, so the artwork is drawn at 62% and centred on the brand ground.
 */
async function maskable(size) {
  const inner = Math.round(size * 0.62)
  const art = await sharp(source).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
  const offset = Math.round((size - inner) / 2)
  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: art, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function apple(size) {
  const inner = Math.round(size * 0.82)
  const art = await sharp(source).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
  const offset = Math.round((size - inner) / 2)
  return sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: art, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

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
