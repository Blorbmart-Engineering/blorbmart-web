/* ═══════════════════════════════════════════════════════════════════════
   Search — a port of lib/features/search/search_screen.dart.

   Debounced, cancellable, and cached: a fast typist generates a request per
   keystroke and only the last one is allowed to render.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clock, Search, SearchX, X } from 'lucide-react'
import {
  clearRecent,
  recentSearches,
  rememberSearch,
  search as runSearch,
  type SearchResults,
} from '../data/search'
import { verticalFromId, type Vertical } from '../models/catalog'
import { EmptyState, SectionHeader, Skeleton } from '../ui/kit'
import { FadeSlideIn, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody } from '../ui/Screen'
import { DishRow, VendorCard } from '../components/CatalogCards'
import { ItemSheet } from '../components/ItemSheet'
import type { MenuItem } from '../models/catalog'

const SUGGESTED = [
  'Jollof rice',
  'Shawarma',
  'Small chops',
  'Pounded yam',
  'Paracetamol',
  'Pepper soup',
]

export default function SearchScreen() {

  const [params] = useSearchParams()
  const hub = params.get('hub')
  const vertical: Vertical | null = hub ? verticalFromId(hub) : null

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [searching, setSearching] = useState(false)
  const [recent, setRecent] = useState<string[]>(() => recentSearches())
  const [open, setOpen] = useState<MenuItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const execute = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (trimmed.length < 2) {
        setResults(null)
        setSearching(false)
        return
      }
      setSearching(true)
      const found = await runSearch(trimmed, { vertical })
      // Null means a newer query started — drop this one rather than render a
      // stale set.
      if (found) {
        setResults(found)
        setSearching(false)
      }
    },
    [vertical],
  )

  const onChange = (value: string) => {
    setQuery(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => void execute(value), 260)
  }

  const commit = (value: string) => {
    setQuery(value)
    if (debounce.current) clearTimeout(debounce.current)
    rememberSearch(value)
    setRecent(recentSearches())
    void execute(value)
  }

  const showIdle = query.trim().length < 2

  return (
    <>
      <AppBar />

      <div style={{ padding: '0 var(--gap-page) var(--gap-md)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-sm)',
            height: 'var(--size-search-bar)',
            paddingInline: 'var(--gap-lg)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--color-line)',
          }}
        >
          <Search size={21} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim().length >= 2) commit(query)
            }}
            placeholder="Search dishes, stores, medicine"
            aria-label="Search Blorbmart"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setResults(null)
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              style={{ display: 'grid', placeItems: 'center', color: 'var(--color-ink-faint)' }}
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>

      <ScreenBody bottomGap="150px">
        {showIdle ? (
          <>
            {recent.length > 0 && (
              <>
                <SectionHeader
                  title="Recent"
                  actionLabel="Clear"
                  onAction={() => {
                    clearRecent()
                    setRecent([])
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--gap-sm)',
                    padding: '0 var(--gap-page)',
                  }}
                >
                  {recent.map((term) => (
                    <Chip key={term} label={term} icon onClick={() => commit(term)} />
                  ))}
                </div>
              </>
            )}

            <SectionHeader title="Try one of these" subtitle="What people near you search for" />
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--gap-sm)',
                padding: '0 var(--gap-page)',
              }}
            >
              {SUGGESTED.map((term) => (
                <Chip key={term} label={term} onClick={() => commit(term)} />
              ))}
            </div>
          </>
        ) : searching && !results ? (
          <div style={{ padding: 'var(--gap-xl) var(--gap-page)' }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={70} radius="var(--radius-md)" style={{ marginBottom: 12 }} />
            ))}
          </div>
        ) : results && results.vendors.length === 0 && results.items.length === 0 ? (
          <EmptyState
            title="Nothing found"
            message={`We could not find anything for "${results.query}". Try a shorter word, or a different spelling.`}
            icon={<SearchX size={30} aria-hidden />}
            actionLabel="Clear search"
            onAction={() => {
              setQuery('')
              setResults(null)
            }}
          />
        ) : results ? (
          <>
            {results.didYouMean && (
              <p
                className="t-body-sm"
                style={{ padding: 'var(--gap-md) var(--gap-page) 0', margin: 0 }}
              >
                Showing results for{' '}
                <strong style={{ color: 'var(--color-ink)' }}>{results.didYouMean}</strong>
              </p>
            )}

            {results.vendors.length > 0 && (
              <>
                <SectionHeader title="Stores" subtitle={`${results.vendors.length} match`} />
                <div style={{ paddingInline: 'var(--gap-page)' }}>
                  {results.vendors.map((v, i) => (
                    <FadeSlideIn key={v.id} delay={staggerFor(i, 4)}>
                      <VendorCard vendor={v} />
                    </FadeSlideIn>
                  ))}
                </div>
              </>
            )}

            {results.items.length > 0 && (
              <>
                <SectionHeader title="Dishes and products" subtitle={`${results.items.length} match`} />
                <div style={{ paddingInline: 'var(--gap-page)' }}>
                  {results.items.map((item, i) => (
                    <FadeSlideIn key={item.id} delay={staggerFor(i, 6)}>
                      <DishRow item={item} showStore onClick={() => setOpen(item)} />
                      <div aria-hidden style={{ height: 1, background: 'var(--color-line)' }} />
                    </FadeSlideIn>
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}
      </ScreenBody>

      <ItemSheet item={open} open={open !== null} onClose={() => setOpen(null)} />
    </>
  )
}

function Chip({
  label,
  onClick,
  icon = false,
}: {
  label: string
  onClick: () => void
  icon?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press t-label"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 38,
        paddingInline: 'var(--gap-lg)',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-line)',
        color: 'var(--color-ink-body)',
      }}
    >
      {icon && <Clock size={14} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />}
      {label}
    </button>
  )
}
