import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import verifyWebhookSignature from './verifyWebhookSignature'

test('verifyWebhookSignature accepts raw secret signatures', () => {
    const payload = JSON.stringify({ hello: 'world' })
    const webhookId = 'evt_123'
    const timestamp = '1710000000'
    const secret = 'super-secret-key'
    const signature = crypto
        .createHmac('sha256', Buffer.from(secret))
        .update(`${webhookId}.${timestamp}.${payload}`)
        .digest('base64')

    const ok = verifyWebhookSignature(
        payload,
        webhookId,
        timestamp,
        `v1,${signature}`,
        secret
    )

    assert.equal(ok, true)
})

test('verifyWebhookSignature accepts polar_whs_ base64 secrets', () => {
    const payload = JSON.stringify({ hello: 'polar' })
    const webhookId = 'evt_456'
    const timestamp = '1710000001'
    const rawSecret = 'another-super-secret'
    const secret = `polar_whs_${Buffer.from(rawSecret).toString('base64')}`
    const signature = crypto
        .createHmac('sha256', Buffer.from(rawSecret))
        .update(`${webhookId}.${timestamp}.${payload}`)
        .digest('base64')

    const ok = verifyWebhookSignature(
        payload,
        webhookId,
        timestamp,
        `v1,${signature}`,
        secret
    )

    assert.equal(ok, true)
})

test('verifyWebhookSignature rejects invalid signatures', () => {
    const ok = verifyWebhookSignature(
        JSON.stringify({ nope: true }),
        'evt_bad',
        '1710000002',
        'v1,totally-wrong',
        'super-secret-key'
    )

    assert.equal(ok, false)
})