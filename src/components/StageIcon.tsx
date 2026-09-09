/* ═══════════════════════════════════════════════════════════════════════
   The order-stage glyph.

   OrderStage carries an icon name rather than a component so the model layer
   stays free of JSX — the Dart original puts IconData on the enum, and this
   is the closest honest equivalent.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  BadgeCheck,
  Bike,
  CircleCheckBig,
  CircleX,
  CookingPot,
  MapPin,
  ReceiptText,
  ShoppingBag,
} from 'lucide-react'

const ICONS = {
  receipt: ReceiptText,
  verified: BadgeCheck,
  cooking: CookingPot,
  bag: ShoppingBag,
  moped: Bike,
  pin: MapPin,
  check: CircleCheckBig,
  cancel: CircleX,
} as const

export type StageIconName = keyof typeof ICONS

export function StageIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  const Glyph = ICONS[icon as StageIconName] ?? ReceiptText
  return <Glyph size={size} aria-hidden />
}
