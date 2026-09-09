/* ═══════════════════════════════════════════════════════════════════════
   Search index — the shared vocabulary between the vendor app (which writes
   keywords) and the buyer app (which queries them). A port of
   lib/data/search/search_index.dart.

   Firestore has no full-text search, so the index lives in the document: a
   `searchKeywords` string array holding every token AND every prefix of every
   token. A prefix query then becomes a single `array-contains`, which is an
   indexed, O(1)-ish lookup rather than a scan.

   "Jollof Rice" produces:
     jo, jol, joll, jollo, jollof, ri, ric, rice, jollofrice, ...

   KEEP THIS FILE IDENTICAL TO THE DART ONE. If the two tokenizers drift,
   products silently stop being findable.
   ═══════════════════════════════════════════════════════════════════════ */

export const MIN_PREFIX = 2
export const MAX_PREFIX = 12

/**
 * Words that carry no search signal. Kept deliberately short — over-stemming
 * hurts more than it helps on a catalogue this size.
 */
export const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'our', 'your', 'a', 'an', 'of', 'in',
  'on', 'at', 'to', 'by', 'is', 'it', 'or', 'per', 'plus', 'pack', 'pcs',
])

/**
 * Common Nigerian food spellings mapped to a canonical form, plus a handful
 * of English/pidgin equivalents. Applied to BOTH the indexed text and the
 * query, so "jelof", "jollof" and "jallof" all land on the same token.
 */
export const SYNONYMS: Record<string, string> = {
  jelof: 'jollof',
  jelloff: 'jollof',
  jallof: 'jollof',
  jolof: 'jollof',
  jollofrice: 'jollof',
  shawama: 'shawarma',
  shawrma: 'shawarma',
  suya: 'suya',
  swallow: 'swallow',
  eba: 'garri',
  gari: 'garri',
  amala: 'amala',
  poundo: 'pounded',
  pounded: 'pounded',
  egusi: 'egusi',
  eguisi: 'egusi',
  efo: 'efo',
  chikwangue: 'fufu',
  fufu: 'fufu',
  foofoo: 'fufu',
  ewa: 'beans',
  ewagoyin: 'beans',
  moimoi: 'moinmoin',
  moin: 'moinmoin',
  moinmoin: 'moinmoin',
  akara: 'akara',
  chiken: 'chicken',
  chikin: 'chicken',
  chikn: 'chicken',
  peppersoup: 'pepper',
  asun: 'asun',
  nkwobi: 'nkwobi',
  isiewu: 'isiewu',
  burga: 'burger',
  burguer: 'burger',
  pizaa: 'pizza',
  piza: 'pizza',
  smallchops: 'chops',
  paracetamol: 'paracetamol',
  panadol: 'paracetamol',
  painkiller: 'analgesic',
  drugs: 'medicine',
  drug: 'medicine',
  meds: 'medicine',
  antimalaria: 'malaria',
  antimalarial: 'malaria',
  cake: 'cake',
  birthdaycake: 'cake',
  catering: 'caterer',
  mc: 'compere',
  dj: 'dj',
}

/**
 * Splits arbitrary text into normalised, de-duplicated search tokens.
 *
 * Handles the messy reality of vendor-entered names: mixed case, ampersands,
 * hyphens, stray punctuation, doubled spaces, and numbers stuck to words
 * ("50cl" -> "50cl" and "cl").
 */
export function tokenize(input: string | null | undefined): string[] {
  if (input == null) return []
  const cleaned = input.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ')
  const out = new Set<string>()

  for (const raw of cleaned.split(/\s+/)) {
    const word = raw.trim()
    if (!word || word.length < 2) continue
    if (STOP_WORDS.has(word)) continue
    out.add(SYNONYMS[word] ?? word)

    // Split a number-word compound so "50cl" is also findable as "cl".
    const match = /^(\d+)([a-z]+)$/.exec(word)
    if (match) {
      const tail = match[2]
      if (tail.length >= 2) out.add(SYNONYMS[tail] ?? tail)
    }
  }
  return [...out]
}

/** Every prefix of `token` from MIN_PREFIX to MAX_PREFIX characters. */
export function prefixesOf(token: string): string[] {
  const end = Math.min(token.length, MAX_PREFIX)
  const out: string[] = []
  for (let i = MIN_PREFIX; i <= end; i++) out.push(token.slice(0, i))
  return out
}

/**
 * The token from a user's query that should drive the Firestore lookup.
 *
 * Longest wins: it is the most selective, so it returns the smallest
 * candidate set for the client to rank. Truncated to MAX_PREFIX because
 * nothing longer was ever indexed.
 */
export function primaryQueryToken(query: string): string | null {
  const tokens = tokenize(query)
  if (!tokens.length) return null
  const best = [...tokens].sort((a, b) => b.length - a.length)[0]
  return best.length > MAX_PREFIX ? best.slice(0, MAX_PREFIX) : best
}

/* ─────────────────────────────────────────────────────────────────────────
   Fuzzy matching
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Damerau-Levenshtein distance, capped at `maxDistance` for an early exit.
 *
 * The transposition case is what makes this worth having over plain
 * Levenshtein: "rcie" -> "rice" is one operation on a phone keyboard and
 * should not be scored the same as two unrelated edits.
 */
export function editDistance(a: string, b: string, maxDistance = 2): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prevPrev = new Array<number>(b.length + 1).fill(0)
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let cur = new Array<number>(b.length + 1).fill(0)

  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      let value = Math.min(
        cur[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      )
      if (
        i > 1 &&
        j > 1 &&
        a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        const transposed = prevPrev[j - 2] + 1
        if (transposed < value) value = transposed
      }
      cur[j] = value
      if (value < rowMin) rowMin = value
    }
    // Every remaining row can only grow, so bail once the best cell is over
    // budget. This is what keeps scoring 300 candidates under a frame.
    if (rowMin > maxDistance) return maxDistance + 1

    const spare = prevPrev
    prevPrev = prev
    prev = cur
    cur = spare
  }
  return prev[b.length]
}

/**
 * True when `token` is a plausible typo of `target`. The allowance scales with
 * length: no fuzz on very short words (where every edit changes meaning —
 * "rice" vs "ice"), one edit up to 7 characters, two beyond that.
 */
export function isFuzzyMatch(token: string, target: string): boolean {
  if (token.length < 4) return false
  const budget = target.length > 7 ? 2 : 1
  return editDistance(token, target, budget) <= budget
}
