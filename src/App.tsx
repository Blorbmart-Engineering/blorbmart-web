import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import AppShell from './components/AppShell'
import PaymentReturn from './components/PaymentReturn'
import RouteSeo from './components/RouteSeo'
import { InstallBanner } from './components/InstallBanner'
import { SplashVisual } from './components/SplashVisual'
import { isSignedIn, useSessionStore } from './store/sessionStore'
import { onForegroundPush } from './lib/push'
import { showToast } from './ui/Screen'

/* ═══════════════════════════════════════════════════════════════════════
   Routes.

   Every screen is code-split. The first paint only needs the shell, splash
   and home chunks — checkout, tracking, bills, events and the wallet all
   arrive on demand. On a 3G connection in Lagos that is the difference
   between a usable app and a blank screen.

   URLs are short and shareable: /r/:id for a storefront, /track/:id for a
   live order. Those get pasted into WhatsApp, so they matter.
   ═══════════════════════════════════════════════════════════════════════ */

const SplashScreen = lazy(() => import('./pages/SplashScreen'))
const OnboardingScreen = lazy(() => import('./pages/OnboardingScreen'))
const WelcomeScreen = lazy(() => import('./pages/WelcomeScreen'))
const LoginScreen = lazy(() => import('./pages/LoginScreen'))
const SignupScreen = lazy(() => import('./pages/SignupScreen'))
const OtpScreen = lazy(() => import('./pages/OtpScreen'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))

const HomeScreen = lazy(() => import('./pages/HomeScreen'))
const HubScreen = lazy(() => import('./pages/HubScreen'))
const SearchScreen = lazy(() => import('./pages/SearchScreen'))
const VendorScreen = lazy(() => import('./pages/VendorScreen'))

const CartScreen = lazy(() => import('./pages/CartScreen'))
const CheckoutScreen = lazy(() => import('./pages/CheckoutScreen'))
const OrderPlaced = lazy(() => import('./pages/OrderPlaced'))
const OrdersScreen = lazy(() => import('./pages/OrdersScreen'))
const TrackOrder = lazy(() => import('./pages/TrackOrder'))

const WalletScreen = lazy(() => import('./pages/WalletScreen'))
const TransactionsScreen = lazy(() => import('./pages/TransactionsScreen'))

const BillsScreen = lazy(() => import('./pages/BillsScreen'))
const BillFormScreen = lazy(() => import('./pages/BillFormScreen'))
const BillReceiptScreen = lazy(() => import('./pages/BillReceiptScreen'))
const BillHistoryScreen = lazy(() => import('./pages/BillHistoryScreen'))

const EventsScreen = lazy(() => import('./pages/EventsScreen'))
const EventDetailScreen = lazy(() => import('./pages/EventDetailScreen'))
const TicketCheckoutScreen = lazy(() => import('./pages/TicketCheckoutScreen'))
const TicketsScreen = lazy(() =>
  import('./pages/TicketsScreen').then((m) => ({ default: m.TicketsScreen })),
)
const TicketScreen = lazy(() =>
  import('./pages/TicketsScreen').then((m) => ({ default: m.TicketScreen })),
)

const GiftCardsScreen = lazy(() => import('./pages/GiftCardsScreen'))
const GiftComposeScreen = lazy(() => import('./pages/GiftComposeScreen'))
const GiftCardScreen = lazy(() => import('./pages/GiftCardScreen'))
const RedeemGiftScreen = lazy(() => import('./pages/RedeemGiftScreen'))

const AccountScreen = lazy(() => import('./pages/AccountScreen'))
const AddressesScreen = lazy(() => import('./pages/AddressesScreen'))
const NotificationsScreen = lazy(() => import('./pages/NotificationsScreen'))
const ReceiptScreen = lazy(() => import('./pages/ReceiptScreen'))

/** Wraps a tab screen in the persistent shell. */
function Shell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}

/**
 * Screens that cannot mean anything without an account.
 *
 * Browsing deliberately is not one of them — the app opens to the catalogue
 * for a guest, the same way the phone build does, and only asks for an
 * account at the point money or an address is involved.
 */
function Protected({ children }: { children: ReactNode }) {
  const session = useSessionStore()
  const location = useLocation()

  if (!session.ready) return <SplashVisual />
  if (!isSignedIn(session)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

/** A pushed screen starts at the top, the way a new route does on a phone. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/**
 * A push that lands while somebody is looking at the app: the service worker
 * only draws a notification when the page is in the background, so the app
 * has to surface this one itself.
 */
function ForegroundPush() {
  const navigate = useNavigate()
  useEffect(() => {
    let dispose: (() => void) | undefined
    void onForegroundPush(({ title, body, link }) => {
      showToast(body ? `${title} — ${body}` : title, 'brand')
      if (link) {
        // Only ever an in-app route; an absolute URL from a push payload is
        // not something to hand to the router.
        if (link.startsWith('/')) setTimeout(() => navigate(link), 1200)
      }
    }).then((fn) => {
      dispose = fn
    })
    return () => dispose?.()
  }, [navigate])
  return null
}

function Boot() {
  const start = useSessionStore((s) => s.start)
  useEffect(() => {
    start()
  }, [start])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Boot />
        <ScrollToTop />
        <RouteSeo />
        <ForegroundPush />
        <PaymentReturn />
        <InstallBanner />

        <Toaster
          position="top-center"
          containerStyle={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          toastOptions={{ duration: 3200 }}
        />

        <Suspense fallback={<SplashVisual />}>
          <Routes>
            {/* ── Boot ───────────────────────────────────── */}
            <Route path="/" element={<SplashScreen />} />
            <Route path="/onboarding" element={<OnboardingScreen />} />

            {/* ── Public ─────────────────────────────────── */}
            <Route path="/welcome" element={<WelcomeScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route path="/verify" element={<OtpScreen />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* ── Discovery ──────────────────────────────── */}
            <Route path="/home" element={<Shell><HomeScreen /></Shell>} />
            <Route path="/hub/:vertical" element={<Shell><HubScreen /></Shell>} />
            <Route path="/search" element={<Shell><SearchScreen /></Shell>} />
            <Route path="/r/:id" element={<Shell><VendorScreen /></Shell>} />

            {/* ── Ordering ───────────────────────────────── */}
            {/* Pushed screens, the way the phone app pushes them: no tab bar
                and no basket bar. Inside the shell, that fixed bar sat on top
                of their sticky Checkout and Pay buttons, so a tap on "Pay"
                landed on "View basket" and went straight back to /cart. */}
            <Route path="/cart" element={<CartScreen />} />
            <Route path="/checkout" element={<Protected><CheckoutScreen /></Protected>} />
            <Route
              path="/order-placed/:orderId"
              element={<Protected><Shell><OrderPlaced /></Shell></Protected>}
            />

            {/* ── Post-order ─────────────────────────────── */}
            <Route path="/orders" element={<Shell><OrdersScreen /></Shell>} />
            <Route
              path="/track/:orderId"
              element={<Protected><Shell><TrackOrder /></Shell></Protected>}
            />

            {/* ── Wallet ─────────────────────────────────── */}
            <Route path="/wallet" element={<Shell><WalletScreen /></Shell>} />
            <Route
              path="/transactions"
              element={<Protected><Shell><TransactionsScreen /></Shell></Protected>}
            />

            {/* ── Bills ──────────────────────────────────── */}
            <Route path="/bills" element={<Shell><BillsScreen /></Shell>} />
            {/* Pushed, like /cart and /checkout and for the same reason: the
                shell's fixed nav bar sits above a sticky footer, so inside it
                the Pay button was covered by the tab bar and a tap on it
                landed on a tab. There was no way to buy airtime on the web. */}
            <Route
              path="/bills/pay/:serviceKey"
              element={<Protected><BillFormScreen /></Protected>}
            />
            <Route
              path="/bills/receipt/:billId"
              element={<Protected><Shell><BillReceiptScreen /></Shell></Protected>}
            />
            <Route
              path="/bills/history"
              element={<Protected><Shell><BillHistoryScreen /></Shell></Protected>}
            />

            {/* ── Events ─────────────────────────────────── */}
            <Route path="/events" element={<Shell><EventsScreen /></Shell>} />
            <Route path="/events/:id" element={<Shell><EventDetailScreen /></Shell>} />
            <Route
              path="/events/:id/checkout"
              element={<Protected><Shell><TicketCheckoutScreen /></Shell></Protected>}
            />
            <Route
              path="/tickets"
              element={<Protected><Shell><TicketsScreen /></Shell></Protected>}
            />
            <Route
              path="/tickets/:ticketId"
              element={<Protected><Shell><TicketScreen /></Shell></Protected>}
            />

            {/* ── Gift cards ─────────────────────────────── */}
            <Route path="/gifts" element={<Shell><GiftCardsScreen /></Shell>} />
            {/* Pushed: its Pay button is a sticky footer (see /cart). */}
            <Route path="/gifts/new" element={<Protected><GiftComposeScreen /></Protected>} />
            <Route
              path="/gifts/:id"
              element={<Protected><Shell><GiftCardScreen /></Shell></Protected>}
            />
            {/* Public, and outside the shell: the QR on a card opens this for
                someone who may never have used Blorbmart. */}
            <Route path="/gift" element={<RedeemGiftScreen />} />

            {/* ── Account ────────────────────────────────── */}
            <Route path="/account" element={<Shell><AccountScreen /></Shell>} />
            <Route
              path="/addresses"
              element={<Protected><Shell><AddressesScreen /></Shell></Protected>}
            />
            <Route
              path="/notifications"
              element={<Protected><Shell><NotificationsScreen /></Shell></Protected>}
            />
            <Route
              path="/receipt/:kind/:id"
              element={<Protected><Shell><ReceiptScreen /></Shell></Protected>}
            />

            {/* ── Legacy URLs still in the wild ──────────── */}
            <Route path="/store/:id" element={<LegacyRedirect prefix="/r" fallback="/home" />} />
            <Route
              path="/track-order/:orderId"
              element={<LegacyRedirect prefix="/track" fallback="/orders" />}
            />
            <Route path="/profile" element={<Navigate to="/account" replace />} />
            <Route path="/restaurants" element={<Navigate to="/hub/restaurants" replace />} />

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

/** Old links shared before the rebrand should still land somewhere real. */
function LegacyRedirect({ prefix, fallback }: { prefix: string; fallback: string }) {
  const id = window.location.pathname.split('/')[2]
  return <Navigate to={id ? `${prefix}/${id}` : fallback} replace />
}
