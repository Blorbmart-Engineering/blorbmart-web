/* ═══════════════════════════════════════════════════════════════════════
   Terms, privacy and account deletion, read without leaving the app.

   The pages themselves live on the landing site, so there is one copy to keep
   right. They are framed here with ?embed=1, which hides the site's own
   navigation; the landing site allows exactly these three pages to be framed
   by the app domains. If the frame cannot load, the page opens in a tab.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { LEGAL_DOCS, isLegalDoc } from '../lib/support'
import { IconButton } from '../ui/Button'
import { Spinner } from '../ui/Loader'
import { AppBar } from '../ui/Screen'

export default function LegalScreen() {
  const { doc } = useParams()
  const [loaded, setLoaded] = useState(false)

  if (!isLegalDoc(doc)) return <Navigate to="/account" replace />
  const { title, url } = LEGAL_DOCS[doc]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--color-surface)' }}>
      <AppBar
        title={title}
        trailing={
          <IconButton label="Open in browser" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
            <ExternalLink size={19} aria-hidden />
          </IconButton>
        }
      />
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {!loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Spinner />
          </div>
        )}
        <iframe
          key={doc}
          title={title}
          src={`${url}?embed=1`}
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      </div>
    </div>
  )
}
