/* ═══════════════════════════════════════════════════════════════════════
   Sharing a link out of the app.

   A pay-for-me link, a treat, an event somebody is going to: all of them
   leave through the same two doors. WhatsApp, because on a Nigerian campus
   that is where a link is going nine times in ten, and the phone's own share
   sheet for everything else, with the clipboard behind it on a desktop.
   ═══════════════════════════════════════════════════════════════════════ */

/** A number as wa.me wants it: country code, no plus, no leading zero. */
function whatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0')) return `234${digits.slice(1)}`
  return digits.length === 10 ? `234${digits}` : digits
}

/**
 * A WhatsApp link carrying `text`. With a phone number it opens that chat;
 * without one it opens the contact picker.
 */
export function whatsAppUrl(text: string, phone = ''): string {
  const number = whatsAppNumber(phone)
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export function openWhatsApp(text: string, phone = ''): void {
  window.open(whatsAppUrl(text, phone), '_blank', 'noopener,noreferrer')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * The phone's share sheet, or the clipboard where there is none.
 *
 * Answers 'shared', 'copied', or 'dismissed' when the customer closed the
 * sheet, which is not a failure and wants no toast.
 */
export async function shareOrCopy({
  title,
  text,
}: {
  title: string
  /** The whole message, link included. */
  text: string
}): Promise<'shared' | 'copied' | 'dismissed' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'dismissed'
      // Anything else: fall through to the clipboard.
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}
