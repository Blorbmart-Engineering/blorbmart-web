/* ═══════════════════════════════════════════════════════════════════════
   The splash artwork.

   Lives apart from the splash screen's boot logic because it is also the
   Suspense fallback for every lazy route — keeping them in one file would
   pull the boot sequence into the entry bundle and defeat the code-splitting
   it exists to hide.
   ═══════════════════════════════════════════════════════════════════════ */

export function SplashVisual({ slow = false }: { slow?: boolean }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--gap-xl)',
        background: 'var(--gradient-brand)',
        padding: 'var(--gap-page)',
      }}
    >
      <img
        src="/assets/icon.png"
        alt="Blorbmart"
        width={88}
        height={88}
        style={{
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
          animation: 'blorb-pop var(--dur-hero) var(--ease-springy) both',
        }}
      />
      <div
        className="t-h2"
        style={{
          color: '#fff',
          animation: 'blorb-fade-in var(--dur-slow) var(--ease-emphasized) 200ms both',
        }}
      >
        Blorbmart
      </div>

      <div
        aria-hidden
        style={{
          width: 120,
          height: 4,
          borderRadius: 'var(--radius-pill)',
          background: 'rgba(255,255,255,0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '40%',
            height: '100%',
            borderRadius: 'var(--radius-pill)',
            background: '#fff',
            animation: 'blorb-sheen 1.4s var(--ease-gentle) infinite',
          }}
        />
      </div>

      {slow && (
        <p
          className="t-caption"
          style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', maxWidth: 260 }}
        >
          Waking up the kitchen. This takes a few seconds on a cold start.
        </p>
      )}
    </div>
  )
}

export default SplashVisual
