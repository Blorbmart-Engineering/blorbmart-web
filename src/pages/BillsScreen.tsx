/* ═══════════════════════════════════════════════════════════════════════
   Bills — a port of lib/features/bills/bills_screen.dart.

   Doubles as the home screen for a bills-only account, which is why it takes
   an `isHome` flag: the same screen, but with the greeting instead of a back
   button.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronRight,
  GraduationCap,
  Receipt,
  Smartphone,
  Trophy,
  Tv,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import { catalog, recentSafe, servicesInCategory, type BillCatalog } from '../data/bills'
import { money, timeAgo } from '../lib/format'
import {
  BILL_STATUS_COLORS,
  BILL_STATUS_LABELS,
  billTitle,
  type BillPayment,
  type BillService,
} from '../models/bills'
import { firstName, greeting, isSignedIn, useSessionStore } from '../store/sessionStore'
import { IconButton } from '../ui/Button'
import { ChipRail, EmptyState, Pill, SectionHeader, Skeleton } from '../ui/kit'
import { FadeSlideIn, PressScale, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody } from '../ui/Screen'
import { NotificationBell } from '../components/HomeWidgets'

const CATEGORY_ICONS: Record<string, typeof Zap> = {
  airtime: Smartphone,
  data: Wifi,
  electricity: Zap,
  tv: Tv,
  cable: Tv,
  betting: Trophy,
  education: GraduationCap,
}

export default function BillsScreen({ isHome = false }: { isHome?: boolean }) {
  const navigate = useNavigate()
  const session = useSessionStore()
  const signedIn = isSignedIn(session)

  const [data, setData] = useState<BillCatalog | null>(null)
  const [recent, setRecent] = useState<BillPayment[]>([])
  const [error, setError] = useState<string | null>(null)

  /**
   * The chosen tab lives in the URL rather than in component state.
   *
   * Going to a biller and coming back unmounts this screen, so state here is
   * lost and the tab reset to the first one — somebody picking a data plan,
   * choosing the wrong network and tapping back landed on Airtime and had to
   * find Data again. The history entry remembers it instead, and `replace`
   * keeps flicking between tabs out of the back stack.
   */
  const [params, setParams] = useSearchParams()
  const category = params.get('c')
  const setCategory = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params)
      next.set('c', id)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const load = useCallback(
    async (refresh = false) => {
      setError(null)
      try {
        const result = await catalog(refresh)
        setData(result)
      } catch {
        setError('Could not load billers. Pull down to retry.')
      }
      if (signedIn) setRecent(await recentSafe(4))
    },
    [signedIn],
  )

  useEffect(() => {
    void load()
  }, [load])

  // A tab the backend no longer offers — a category the aggregator has since
  // switched off, or an old link — falls back to the first one rather than
  // showing an empty screen.
  const active =
    data?.categories.find((c) => c.id === category)?.id ?? data?.categories[0]?.id ?? null
  const services = data && active ? servicesInCategory(data, active) : []

  return (
    <>
      {isHome ? (
        <div
          style={{
            padding:
              'calc(var(--safe-top) + var(--gap-xl)) var(--gap-page) var(--gap-xxl)',
            background: 'var(--gradient-brand)',
            borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--gap-md)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-h1" style={{ color: '#fff' }}>
                {signedIn ? `${greeting()}, ${firstName(session)}` : greeting()}
              </div>
              <p
                className="t-body-sm"
                style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.82)' }}
              >
                Airtime, data, power and TV — all in one place.
              </p>
            </div>
            <NotificationBell onClick={() => navigate('/notifications')} />
          </div>
        </div>
      ) : (
        <AppBar
          title="Bills"
          subtitle="Airtime, data, power, TV"
          trailing={
            <IconButton label="Payment history" onClick={() => navigate('/bills/history')}>
              <Receipt size={19} aria-hidden />
            </IconButton>
          }
        />
      )}

      <ScreenBody bottomGap="150px">
        {data?.simulated && (
          <div style={{ padding: 'var(--gap-md) var(--gap-page) 0' }}>
            <Pill
              label="Test mode. No real airtime or tokens are delivered yet."
              tone="warning"
            />
          </div>
        )}

        {/* ── Categories ─────────────────────────────────────────────── */}
        {error ? (
          <EmptyState
            title="Bills unavailable"
            message={error}
            icon={<WifiOff size={30} aria-hidden />}
            actionLabel="Try again"
            onAction={() => void load(true)}
          />
        ) : data === null ? (
          <div style={{ padding: 'var(--gap-xl) var(--gap-page)' }}>
            <Skeleton height={40} radius="var(--radius-pill)" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={92} radius="var(--radius-md)" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <SectionHeader title="Pay a bill" subtitle="Delivered in seconds" />

            {data.categories.length > 1 && (
              <div style={{ paddingBottom: 'var(--gap-lg)' }}>
                <ChipRail
                  options={data.categories.map((c) => c.label)}
                  selected={data.categories.find((c) => c.id === active)?.label ?? ''}
                  onSelect={(label) => {
                    const found = data.categories.find((c) => c.label === label)
                    if (found) setCategory(found.id)
                  }}
                />
              </div>
            )}

            {services.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                message="No billers are available in this category right now."
                icon={<Receipt size={28} aria-hidden />}
                compact
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--gap-md)',
                  padding: '0 var(--gap-page)',
                }}
              >
                {services.map((service, i) => (
                  <FadeSlideIn key={service.id} delay={staggerFor(i, 6)}>
                    <ServiceTile
                      service={service}
                      category={active ?? ''}
                      onClick={() => navigate(`/bills/pay/${encodeURIComponent(service.id)}`)}
                    />
                  </FadeSlideIn>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Recent ─────────────────────────────────────────────────────
            Under the billers, never above them. Somebody opening Bills came
            to pay one; what they paid last month is a reference, and a
            reference that pushes the actual task below the fold is a
            reference in the wrong place. Same order as bills_screen.dart. */}
        {recent.length > 0 && (
          <>
            <SectionHeader
              title="Recent payments"
              actionLabel="History"
              onAction={() => navigate('/bills/history')}
            />
            <div style={{ paddingInline: 'var(--gap-page)' }}>
              {recent.map((payment, i) => (
                <FadeSlideIn key={payment.id} delay={staggerFor(i, 4)}>
                  <PressScale
                    scale={0.99}
                    onClick={() => navigate(`/bills/receipt/${payment.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--gap-md)',
                      width: '100%',
                      padding: 'var(--gap-md) 0',
                      borderBottom: '1px solid var(--color-line)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="t-h4 clamp-1" style={{ display: 'block' }}>
                        {billTitle(payment)}
                      </span>
                      <span className="t-caption clamp-1" style={{ display: 'block' }}>
                        {payment.target} · {timeAgo(payment.createdAt)}
                      </span>
                    </span>
                    <span style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className="t-price" style={{ display: 'block' }}>
                        {money(payment.total)}
                      </span>
                      <span
                        className="t-caption-sm"
                        style={{ color: BILL_STATUS_COLORS[payment.status] }}
                      >
                        {BILL_STATUS_LABELS[payment.status]}
                      </span>
                    </span>
                  </PressScale>
                </FadeSlideIn>
              ))}
            </div>
          </>
        )}
      </ScreenBody>
    </>
  )
}

function ServiceTile({
  service,
  category,
  onClick,
}: {
  service: BillService
  category: string
  onClick: () => void
}) {
  const Glyph = CATEGORY_ICONS[category] ?? Receipt

  return (
    <PressScale
      scale={0.96}
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: 'var(--gap-lg)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-line)',
        boxShadow: 'var(--shadow-xs)',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 42,
          height: 42,
          borderRadius: 'var(--radius-sm)',
          background: `color-mix(in srgb, ${service.color} 12%, transparent)`,
          color: service.color,
        }}
      >
        <Glyph size={21} aria-hidden />
      </span>

      <span className="t-h4 clamp-1" style={{ display: 'block', marginTop: 'var(--gap-md)' }}>
        {service.name}
      </span>

      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 4,
          minWidth: 0,
        }}
      >
        {service.cashbackPercent > 0 ? (
          <Pill
            label={`${service.cashbackPercent.toFixed(0)}% back`}
            tone="success"
            dense
          />
        ) : (
          <span className="t-caption clamp-1">{service.accountLabel}</span>
        )}
        <span style={{ flex: 1 }} />
        <ChevronRight size={16} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
      </span>
    </PressScale>
  )
}
