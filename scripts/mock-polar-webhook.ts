import crypto from 'node:crypto'

const secret = process.env.POLAR_WEBHOOK_SECRET || 'polar_whs_ZGVtb19zZWNyZXQ='
const targetUrl =
    process.env.POLAR_WEBHOOK_URL || 'http://localhost:2222/webhooks/polar'
const eventType = process.argv[2] || 'checkout.updated'

const pendingClawId = process.env.PENDING_CLAW_ID || 'pending-demo-123'
const checkoutId = process.env.CHECKOUT_ID || 'checkout-demo-123'
const subscriptionId = process.env.SUBSCRIPTION_ID || 'sub-demo-123'
const customerId = process.env.CUSTOMER_ID || 'cus-demo-123'
const productId = process.env.PRODUCT_ID || 'prod-demo-123'

const payload =
    eventType === 'subscription.active'
        ? {
              type: 'subscription.active',
              data: {
                  id: subscriptionId,
                  status: 'active',
                  customerId,
                  productId,
                  currentPeriodEnd: null,
                  metadata: {
                      pendingClawId
                  }
              }
          }
        : {
              type: 'checkout.updated',
              data: {
                  id: checkoutId,
                  status: 'succeeded',
                  customerId,
                  productId,
                  subscriptionId,
                  amount: 2000,
                  currency: 'USD',
                  metadata: {
                      pendingClawId
                  }
              }
          }

const rawPayload = JSON.stringify(payload)
const webhookId = `evt_${crypto.randomUUID()}`
const timestamp = Math.floor(Date.now() / 1000).toString()
const signingSecret = secret.startsWith('polar_whs_')
    ? Buffer.from(secret.slice(10), 'base64')
    : Buffer.from(secret)
const signature = crypto
    .createHmac('sha256', signingSecret)
    .update(`${webhookId}.${timestamp}.${rawPayload}`)
    .digest('base64')

const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        'webhook-id': webhookId,
        'webhook-timestamp': timestamp,
        'webhook-signature': `v1,${signature}`
    },
    body: rawPayload
})

console.log(JSON.stringify({
    targetUrl,
    eventType,
    status: response.status,
    response: await response.text(),
    headers: {
        'webhook-id': webhookId,
        'webhook-timestamp': timestamp,
        'webhook-signature': `v1,${signature}`
    },
    payload
}, null, 2))
