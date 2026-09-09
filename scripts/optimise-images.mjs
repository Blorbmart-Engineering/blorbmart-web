/* ═══════════════════════════════════════════════════════════════════════
   Compresses the photographic assets for the web.

   The onboarding photographs ship at 1500px and ~950KB each because they were
   cut for a Flutter bundle, where they are installed once rather than
   downloaded. On the web they are three megabytes across the first three
   screens a new customer ever sees, on the connection least able to afford
   it.

   They are only ever drawn into a phone-width column, so 900px wide at
   WebP q72 is indistinguishable and roughly a twentieth of the bytes. The
   JPEGs are kept as a fallback for the handful of browsers without WebP.

   Run with `npm run images`. Output is committed.
   ═══════════════════════════════════════════════════════════════════════ */

import { readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const assets = resolve(here, '../public/assets')

const kb = (bytes) => `${Math.round(bytes / 1024)}KB`

async function convert(name) {
  const source = resolve(assets, `${name}.jpg`)
  const before = (await stat(source)).size

  const buffer = await sharp(source)
    // The column is at most 520px CSS wide; 900px covers a 2x display.
    .resize(900, 900, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer()

  await writeFile(resolve(assets, `${name}.webp`), buffer)
  console.log(`${name}: ${kb(before)} -> ${kb(buffer.length)} (webp)`)
  return { before, after: buffer.length }
}

let saved = 0
for (const entry of await readdir(assets)) {
  if (!entry.startsWith('onboarding') || !entry.endsWith('.jpg')) continue
  const { before, after } = await convert(entry.replace(/\.jpg$/, ''))
  saved += before - after
}
console.log(`\nSaved ${kb(saved)} across the onboarding flow.`)
