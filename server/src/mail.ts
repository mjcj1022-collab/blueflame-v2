/**
 * Transactional email via Resend's HTTP API (no SDK needed — Node's built-in
 * fetch is enough). With no key set, sends are skipped and logged instead of
 * failing, so nothing breaks before this is configured.
 *
 * Env:
 *   RESEND_API_KEY  Resend API key (unset → disabled, just logs)
 *   EMAIL_FROM      "Mandrel <hello@yourdomain.com>" — must be a domain
 *                   verified in Resend; falls back to their shared test
 *                   sender, which only delivers to your own Resend account
 *                   email until a domain is verified
 *   SITE_URL        the hosted site's URL, used to build links in emails
 */

const key = () => process.env.RESEND_API_KEY || ''
const from = () => process.env.EMAIL_FROM || 'Mandrel <onboarding@resend.dev>'
export const emailEnabled = (): boolean => !!key()

interface SendArgs { to: string; subject: string; html: string }

async function send({ to, subject, html }: SendArgs): Promise<void> {
  if (!key()) {
    console.log(`[mail] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`)
    return
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: from(), to: [to], subject, html }),
    })
    if (!r.ok) console.error(`[mail] resend ${r.status}: ${await r.text()}`)
  } catch (e) {
    // Never let a mail failure break the caller (e.g. the Stripe webhook,
    // which must still return 200 so Stripe doesn't retry the whole event).
    console.error('[mail] send failed:', (e as Error).message)
  }
}

/** Sent right after a one-time offline-build purchase clears. Points the
 *  buyer at signing in to download rather than a raw file link, since the
 *  download itself is auth-gated to their own paid account. */
export async function sendOfflineDownloadEmail(to: string, shopName: string): Promise<void> {
  const site = process.env.SITE_URL || 'https://mjcj1022-collab.github.io/blueflame-v2/'
  await send({
    to,
    subject: 'Your Mandrel offline download is ready',
    html: `
      <div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <h1 style="font-size:22px;margin:0 0 4px">Thanks for buying Mandrel — Offline</h1>
        <p style="color:#555;font-size:14px;line-height:1.6">
          ${shopName ? `${shopName}, your` : 'Your'} one-time purchase is confirmed and your downloadable
          copy is ready.
        </p>
        <p style="margin:28px 0">
          <a href="${site}" style="background:#1F8A6B;color:#fff;padding:12px 22px;text-decoration:none;
            border-radius:6px;font-size:14px;font-weight:bold">Sign in &amp; download</a>
        </p>
        <p style="color:#555;font-size:14px;line-height:1.6">
          Sign in with the account you purchased with, and you'll see a "Download offline build" button
          waiting for you. It's a .zip with a Windows and Mac launcher inside — no install needed, just
          unzip and run it.
        </p>
        <p style="color:#888;font-size:12px;margin-top:32px">
          Questions? Just reply to this email.
        </p>
      </div>
    `,
  })
}
