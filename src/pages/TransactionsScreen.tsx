/* ═══════════════════════════════════════════════════════════════════════
   The full wallet ledger.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { transactions, type WalletEntry } from '../data/wallet'
import { EmptyState, Skeleton } from '../ui/kit'
import { FadeSlideIn, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody } from '../ui/Screen'
import { EntryRow } from './WalletScreen'

export default function TransactionsScreen() {
  const [entries, setEntries] = useState<WalletEntry[] | null>(null)

  useEffect(() => {
    void transactions(60).then(setEntries)
  }, [])

  return (
    <>
      <AppBar title="Wallet history" subtitle="Every credit and debit" />
      <ScreenBody bottomGap="150px" padded>
        {entries === null ? (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton
              key={i}
              height={62}
              radius="var(--radius-md)"
              style={{ marginBottom: 'var(--gap-sm)' }}
            />
          ))
        ) : entries.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            message="Top-ups, order payments and refunds all show up here."
            icon={<Wallet size={30} aria-hidden />}
          />
        ) : (
          entries.map((entry, i) => (
            <FadeSlideIn key={entry.id} delay={staggerFor(i, 6)}>
              <EntryRow entry={entry} />
            </FadeSlideIn>
          ))
        )}
      </ScreenBody>
    </>
  )
}
