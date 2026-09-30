/** Blorbmart support on WhatsApp — 0904 592 7921, the number every "message support" opens. */
export const SUPPORT_WHATSAPP = '2349045927921'

/** The support inbox. */
export const SUPPORT_EMAIL = 'blorbmarthelpdesk@gmail.com'

export function supportUrl(message = 'Hello Blorbmart, I need help'): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`
}

export function supportEmailUrl(subject = 'Help with Blorbmart'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

/**
 * The legal pages, served by the landing site. Opened in-app by LegalScreen;
 * the landing site allows exactly these three to be framed by our app domains
 * (blorbmart-landing/vercel.json), and ?embed=1 hides its own navigation.
 */
export const LEGAL_DOCS = {
  terms: { title: 'Terms and conditions', url: 'https://www.blorbmart.com.ng/terms' },
  privacy: { title: 'Privacy policy', url: 'https://www.blorbmart.com.ng/privacy' },
  'delete-account': { title: 'Delete my account', url: 'https://www.blorbmart.com.ng/delete-account' },
} as const

export type LegalDoc = keyof typeof LEGAL_DOCS

export const isLegalDoc = (value: string | undefined): value is LegalDoc =>
  value != null && Object.prototype.hasOwnProperty.call(LEGAL_DOCS, value)
