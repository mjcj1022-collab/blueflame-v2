// Stripe is optional — payments need STRIPE_SECRET_KEY and `npm i stripe`.
// Everything else in the API works without it.
export async function createPaymentIntent(amountCents: number, metadata: Record<string, string>) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe not configured — set STRIPE_SECRET_KEY in .env')
  const StripeMod = await import('stripe').catch(() => { throw new Error('Stripe not installed — run: npm i stripe') })
  const stripe = new StripeMod.default(key)
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata
  })
}

/**
 * Create a Stripe Checkout Session for a subscription ($40/mo) or a one-time
 * purchase (the $450 offline build). The tenant id rides along as metadata (and
 * on the subscription itself) so the webhook can attach the result to the shop.
 * Returns the session; the caller hands its `url` to the browser.
 */
export async function createCheckoutSession(opts: {
  mode: 'subscription' | 'payment'
  priceId: string
  tenantId: string
  planId: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string | null }> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe not configured — set STRIPE_SECRET_KEY')
  if (!opts.priceId) throw new Error(`No Stripe price configured for plan "${opts.planId}" — set the STRIPE_PRICE_* env var`)
  const StripeMod = await import('stripe').catch(() => { throw new Error('Stripe not installed — run: npm i stripe') })
  const stripe = new StripeMod.default(key)
  const metadata = { tenant_id: opts.tenantId, plan_id: opts.planId }
  const session = await stripe.checkout.sessions.create({
    mode: opts.mode,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    customer_email: opts.customerEmail,
    client_reference_id: opts.tenantId,
    metadata,
    ...(opts.mode === 'subscription' ? { subscription_data: { metadata } } : {}),
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  })
  return { url: session.url }
}

/** A verified Stripe webhook event. `type` + `data.object` are enough to react
 *  to payments; the shape is kept loose so the route needs no Stripe types. */
export interface WebhookEvent { type: string; data: { object: Record<string, unknown> } }

/**
 * Verify a webhook payload against the signing secret and return the event.
 * The raw (unparsed) request body is required — verification fails on JSON that
 * has been re-serialized. Set STRIPE_WEBHOOK_SECRET from the Stripe dashboard.
 */
export async function constructWebhookEvent(rawBody: Buffer | string, signature: string): Promise<WebhookEvent> {
  const key = process.env.STRIPE_SECRET_KEY
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!key || !whSecret) throw new Error('Stripe webhook not configured — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET')
  const StripeMod = await import('stripe').catch(() => { throw new Error('Stripe not installed — run: npm i stripe') })
  const stripe = new StripeMod.default(key)
  return stripe.webhooks.constructEvent(rawBody, signature, whSecret) as unknown as WebhookEvent
}
