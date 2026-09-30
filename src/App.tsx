import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
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
import { RouteLoader } from './ui/Loader'
import { applyPendingReferral, rememberReferral } from './data/referral'

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
const FinishSignupScreen = lazy(() => import('./pages/FinishSignupScreen'))
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
const GroupScreen = lazy(() => import('./pages/GroupScreen'))
const PayRequestScreen = lazy(() => import('./pages/PayRequestScreen'))
const PayScreen = lazy(() => import('./pages/PayScreen'))
const TreatScreen = lazy(() => import('./pages/TreatScreen'))
const LegalScreen = lazy(() => import('./pages/LegalScreen'))

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

/**
 * Where an account with no profile may still be. Sign-up and the code screen
 * are there because an email account exists for a moment before its
 * documents do; the rest are pages that need no account at all.
 */
const NO_PROFILE_NEEDED = /^\/(finish-signup|signup|verify|login|welcome|onboarding|legal|pay|treat|gift)(\/|$)/

/**
 * Sends a signed-in account that has no profile to finish signing up.
 *
 * "Continue with Google" makes the account first and asks for a phone number
 * and a campus second. Somebody who closes the tab in between comes back
 * signed in to an account that cannot order, so wherever they land they are
 * brought back to the one screen that fixes it.
 */
function ProfileGate() {
  const missing = useSessionStore((s) => s.profileMissing)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!missing || pathname === '/' || NO_PROFILE_NEEDED.test(pathname)) return
    navigate('/finish-signup', { replace: true, state: { from: pathname } })
  }, [missing, pathname, navigate])
  return null
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

/*
 * Whether a screen has painted yet. Until then a lazy route is part of boot
 * and waits under the splash; after it, a screen still downloading gets the
 * in-app loader instead of the whole blue splash flashing up again, which on
 * a first visit to every tab looked like the app restarting.
 */
let painted = false

function Painted() {
  const { pathname } = useLocation()
  useEffect(() => {
    // The boot screen is the splash itself; the first real screen after it
    // is what counts.
    if (pathname !== '/') painted = true
  }, [pathname])
  return null
}

function RouteFallback() {
  return painted ? <RouteLoader /> : <SplashVisual />
}

function Boot() {
  const start = useSessionStore((s) => s.start)
  useEffect(() => {
    // `?ref=CODE` on any shop URL counts the same as an /invite link, so a
    // code can ride on a link to a store or an event as well.
    rememberReferral(new URLSearchParams(window.location.search).get('ref'))
    start()
  }, [start])
  return null
}

/**
 * /invite/:code — a customer's invite link.
 *
 * Remembers the code and gets out of the way: a newcomer lands on signup, and
 * the code is sent once their account exists. Someone already signed in goes
 * home; the server decides whether their account is new enough to count.
 */
function InviteRedirect() {
  const { code } = useParams()
  const session = useSessionStore()

  // During render rather than in an effect: <Navigate> below navigates from
  // its own effect, and this must be stored before that happens.
  rememberReferral(code)

  const signedIn = session.ready && isSignedIn(session)
  useEffect(() => {
    if (signedIn) void applyPendingReferral()
  }, [signedIn])

  if (!session.ready) return <SplashVisual />
  return <Navigate to={signedIn ? '/home' : '/signup'} replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Boot />
        <ProfileGate />
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

        <Suspense fallback={<RouteFallback />}>
          <Painted />
          <Routes>
            {/* ── Boot ───────────────────────────────────── */}
            <Route path="/" element={<SplashScreen />} />
            <Route path="/onboarding" element={<OnboardingScreen />} />

            {/* ── Public ─────────────────────────────────── */}
            <Route path="/welcome" element={<WelcomeScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route path="/verify" element={<OtpScreen />} />
            <Route path="/finish-signup" element={<FinishSignupScreen />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/invite/:code" element={<InviteRedirect />} />

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
            {/* Full screen, like the phone app's pushed route: the payment
                celebration is not a tab. */}
            <Route
              path="/order-placed/:orderId"
              element={<Protected><OrderPlaced /></Protected>}
            />

            {/* ── Links sent to somebody else ────────────── */}
            {/* The requester's waiting room for a pay-for-me link. */}
            <Route
              path="/pay-request/:orderId"
              element={<Protected><PayRequestScreen /></Protected>}
            />
            {/* Public, and outside the shell: opened by a parent or a friend
                who may never have used Blorbmart. */}
            <Route path="/pay/:token" element={<PayScreen />} />
            <Route path="/treat/:token" element={<TreatScreen />} />

            {/* ── Post-order ─────────────────────────────── */}
            {/* Outside the Shell: the screen has its own sticky pay button. */}
            <Route path="/group/:code" element={<Protected><GroupScreen /></Protected>} />
            {/* Terms, privacy and deletion, framed in the app. Open to everyone. */}
            <Route path="/legal/:doc" element={<LegalScreen />} />
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
            {/* Pushed, like /cart and /checkout: both end in a sticky button
                ("Get tickets", "Pay"), and inside the shell the fixed tab bar
                sat on top of it, so a tap on it landed on a tab. */}
            <Route path="/events/:id" element={<EventDetailScreen />} />
            <Route
              path="/events/:id/checkout"
              element={<Protected><TicketCheckoutScreen /></Protected>}
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
