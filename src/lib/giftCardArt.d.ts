/* Types for giftCardArt.js, which is generated from the backend's
   services/giftCards/art.js and shared with it line for line. */

export type GiftTheme = {
  id: string
  name: string
  headline: string
  palette: string
  motif: string
  type: string
  blurb: string
  custom?: boolean
}

export type GiftPalette = {
  name: string
  dark: boolean
  bg: string[]
  glow: string[]
  ink: string
  soft: string
  accent: string
  foil: string[]
  motif: string[]
  panel: string
  panelLine: string
}

export type GiftDesign = {
  theme: string
  palette: string
  motif: string
  type: string
  headline: string
}

export type GiftCardArtInput = {
  design: Partial<GiftDesign>
  amount: number
  code?: string
  to?: string
  from?: string
  message?: string
  expiresAt?: string | null
  qrPath?: string
  qrSize?: number
  maskedCode?: string
  note?: string
  status?: string
  uid?: string
}

declare const GiftCardArt: {
  CARD_W: number
  CARD_H: number
  LIMITS: { headline: number; name: number; message: number }
  THEMES: GiftTheme[]
  PALETTES: Record<string, GiftPalette>
  MOTIFS: Record<string, string>
  TYPES: Record<string, string>
  cleanText(value: unknown, max?: number): string
  resolveDesign(input: Partial<GiftDesign> | undefined): GiftDesign
  formatAmount(amount: number): string
  formatDate(value: string | null | undefined): string
  renderGiftCardSvg(input: GiftCardArtInput): string
  measure(text: string, font: string, size: number, tracking?: number): number
}

export default GiftCardArt
