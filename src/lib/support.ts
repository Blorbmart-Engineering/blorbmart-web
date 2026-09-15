/** Blorbmart support on WhatsApp — the number every "message support" opens. */
export const SUPPORT_WHATSAPP = '2349022594853'

export function supportUrl(message = 'Hello Blorbmart, I need help'): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`
}
