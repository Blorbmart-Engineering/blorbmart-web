/* ═══════════════════════════════════════════════════════════════════════
   Joining an employer's meal plan from an invitation: /work/join/:code.
   The invitation is bound to an email or phone, so the server says plainly
   when this account is not the one it was sent to.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { ApiError, apiErrorMessage } from '../lib/api'
import { money } from '../lib/format'
import { acceptInvite, previewInvite, scheduleSummary } from '../data/work'
import { Button } from '../ui/Button'
import { Card, EmptyState, Skeleton } from '../ui/kit'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'

type Preview = Awaited<ReturnType<typeof previewInvite>>

export default function WorkJoinScreen() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    previewInvite(code)
      .then(setInvite)
      .catch((e) => setError(apiErrorMessage(e, 'That invitation could not be found.')))
  }, [code])

  const accept = async () => {
    setBusy(true)
    try {
      await acceptInvite(code)
      showToast(`You are on ${invite?.companyName}'s meal plan`, 'success')
      navigate('/work', { replace: true })
    } catch (e) {
      const message = apiErrorMessage(e, 'We could not add you. Try again.')
      if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') navigate('/verify', { state: { from: `/work/join/${code}` } })
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AppBar title="Join a meal plan" />
      <ScreenBody padded>
        {!invite && !error && <Skeleton height={180} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-lg)' }} />}
        {error && !invite && <EmptyState title="Invitation not available" message={error} actionLabel="Back to Work" onAction={() => navigate('/work')} />}
        {invite && (
          <Card style={{ marginTop: 'var(--gap-lg)' }}>
            <Briefcase size={28} aria-hidden style={{ color: 'var(--color-brand)' }} />
            <div className="t-h2" style={{ marginTop: 'var(--gap-md)' }}>{invite.companyName} pays for your meals</div>
            <p className="t-body-sm" style={{ margin: 'var(--gap-md) 0 0' }}>
              Up to {money(invite.dailyLimit)} a day · {scheduleSummary(invite.schedule)} ·{' '}
              {invite.deliveryMode === 'office' ? 'delivered to your office' : 'delivered to your own address'}.
            </p>
            <p className="t-caption" style={{ margin: 'var(--gap-md) 0 0' }}>
              This invitation was sent to {invite.sentTo}. Sign in with that account to accept it.
            </p>
            {error && <p className="t-body-sm" role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600, marginTop: 'var(--gap-md)' }}>{error}</p>}
          </Card>
        )}
      </ScreenBody>
      {invite && (
        <StickyFooter>
          <Button label="Accept and join" busy={busy} glow onClick={() => void accept()} />
        </StickyFooter>
      )}
    </>
  )
}
