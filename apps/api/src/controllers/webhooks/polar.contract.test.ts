import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import { Hono } from 'hono'

import { createHandlePolarWebhook } from './polar'
import { provisionClaw } from '@/controllers/claws/provisionClaw'
import { createProvisionClawTestDb } from '@/test/createProvisionClawTestDb'

const rawSecret = 'polar-contract-secret'
const webhookSecret = `polar_whs_${Buffer.from(rawSecret).toString('base64')}`

const checkoutUpdatedPayload = {
    type: 'checkout.updated',
    data: {
        id: 'chk_123',
        status: 'succeeded',
        subscriptionId: 'sub_contract_1',
        customerId: 'cus_contract_1',
        productId: 'prod_contract_1',
        metadata: {
            pendingClawId: 'pending-contract-1'
        }
    }
}

const subscriptionActivePayload = {
    type: 'subscription.active',
    data: {
        id: 'sub_existing_1',
        status: 'active',
        customerId: 'cus_existing_1',
        productId: 'prod_existing_1',
        metadata: {
            pendingClawId: 'pending-existing-1'
        }
    }
}

function signPayload(payload: unknown) {
    const rawPayload = JSON.stringify(payload)
    const webhookId = 'evt_contract_1'
    const timestamp = '1710001234'
    const signature = crypto
        .createHmac('sha256', Buffer.from(rawSecret))
        .update(`${webhookId}.${timestamp}.${rawPayload}`)
        .digest('base64')

    return {
        rawPayload,
        headers: {
            'content-type': 'application/json',
            'webhook-id': webhookId,
            'webhook-timestamp': timestamp,
            'webhook-signature': `v1,${signature}`
        }
    }
}

test('POST /webhooks/polar verifies signed checkout.updated payload and triggers provision side effects', async () => {
    process.env.POLAR_WEBHOOK_SECRET = webhookSecret

    const db = createProvisionClawTestDb({
        pendingClawsById: {
            'pending-contract-1': {
                id: 'pending-contract-1',
                userId: 'user-contract-1',
                name: 'Webhook Claw',
                provider: 'hetzner',
                planId: 'cpx21',
                location: 'fsn1',
                rootPassword: 'root-from-webhook',
                sshKeyId: 'ssh-contract-1',
                volumeSize: 20,
                model: 'openai/gpt-4.1',
                tier: 'pro',
                apiToken: 'api-from-webhook'
            }
        },
        sshKeysById: {
            'ssh-contract-1': {
                id: 'ssh-contract-1',
                providerKeyId: 321
            }
        }
    })

    const calls = {
        createServer: [] as any[],
        createVolume: [] as any[],
        createDnsRecord: [] as Array<[string, string]>
    }

    const app = new Hono()
    app.post(
        '/webhooks/polar',
        createHandlePolarWebhook({
            provisionClaw: (params) =>
                provisionClaw(params, {
                    db: db as any,
                    getProvider: () =>
                        ({
                            async getServerTypes() {
                                return [
                                    {
                                        name: 'cpx21',
                                        description: 'Test plan',
                                        cores: 2,
                                        memory: 4,
                                        disk: 80,
                                        architecture: 'x86',
                                        priceHourly: 0.1,
                                        priceMonthly: 10
                                    }
                                ]
                            },
                            async createServer(...args: any[]) {
                                calls.createServer.push(args)
                                return {
                                    serverId: 101,
                                    ip: '203.0.113.10',
                                    rootPassword: 'ignored'
                                }
                            },
                            async createVolume(...args: any[]) {
                                calls.createVolume.push(args)
                                return {
                                    id: 202,
                                    size: 20,
                                    location: 'fsn1'
                                }
                            }
                        }) as any,
                    cloudflare: {
                        async createDNSRecord(subdomain, ip) {
                            calls.createDnsRecord.push([subdomain, ip])
                            return {
                                id: 'dns-contract-1',
                                name: `${subdomain}.clawhost.cloud`
                            }
                        }
                    },
                    generateSlug: () => 'webhook-slug',
                    generateToken: () => 'gateway-token',
                    generateCloudInit: (...args) =>
                        `cloud-init:${JSON.stringify(args)}`,
                    encrypt: (value) => `enc:${value}`,
                    randomUUID: (() => {
                        const ids = ['claw-contract-1', 'volume-contract-1']
                        return () => ids.shift() || 'extra-contract-id'
                    })()
                })
        })
    )

    const signed = signPayload(checkoutUpdatedPayload)
    const response = await app.request('/webhooks/polar', {
        method: 'POST',
        headers: signed.headers,
        body: signed.rawPayload
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.deepEqual(body.data, { received: true })

    assert.equal(db.state.deletedPendingClaws.length, 1)
    assert.equal(db.state.deletedPendingClaws[0].id, 'pending-contract-1')
    assert.equal(db.state.insertedClaws.length, 1)
    assert.equal(db.state.insertedClaws[0].polarSubscriptionId, 'sub_contract_1')
    assert.equal(db.state.insertedClaws[0].polarProductId, 'prod_contract_1')
    assert.equal(db.state.insertedClaws[0].polarCustomerId, 'cus_contract_1')
    assert.equal(db.state.insertedClaws[0].subdomain, 'webhook-slug')
    assert.equal(db.state.insertedClaws[0].gatewayToken, 'enc:gateway-token')
    assert.deepEqual(calls.createDnsRecord, [['webhook-slug', '203.0.113.10']])
    assert.equal(calls.createServer.length, 1)
    assert.equal(calls.createVolume.length, 1)
    assert.deepEqual(db.state.clawUpdates, [
        {
            id: 'claw-contract-1',
            payload: {
                providerServerId: '101',
                status: 'configuring',
                ip: '203.0.113.10'
            }
        }
    ])
})

test('POST /webhooks/polar ignores signed subscription.active when claw already exists for subscription', async () => {
    process.env.POLAR_WEBHOOK_SECRET = webhookSecret

    const db = createProvisionClawTestDb({
        existingClawsBySubscriptionId: {
            sub_existing_1: {
                id: 'claw-existing-1',
                polarSubscriptionId: 'sub_existing_1',
                provider: 'hetzner',
                providerServerId: 'srv-existing-1',
                subdomain: 'existing-slug'
            }
        },
        pendingClawsById: {
            'pending-existing-1': {
                id: 'pending-existing-1',
                userId: 'user-existing-1',
                name: 'Should Not Provision',
                provider: 'hetzner',
                planId: 'cpx21',
                location: 'fsn1',
                volumeSize: 20
            }
        }
    })

    let provisionCalls = 0
    const calls = {
        createServer: [] as any[],
        createVolume: [] as any[],
        createDnsRecord: [] as Array<[string, string]>
    }

    const app = new Hono()
    app.post(
        '/webhooks/polar',
        createHandlePolarWebhook({
            db: db as any,
            provisionClaw: async (params) => {
                provisionCalls += 1
                return provisionClaw(params, {
                    db: db as any,
                    getProvider: () =>
                        ({
                            async getServerTypes() {
                                return [
                                    {
                                        name: 'cpx21',
                                        description: 'Test plan',
                                        cores: 2,
                                        memory: 4,
                                        disk: 80,
                                        architecture: 'x86',
                                        priceHourly: 0.1,
                                        priceMonthly: 10
                                    }
                                ]
                            },
                            async createServer(...args: any[]) {
                                calls.createServer.push(args)
                                return {
                                    serverId: 999,
                                    ip: '203.0.113.99',
                                    rootPassword: 'ignored'
                                }
                            },
                            async createVolume(...args: any[]) {
                                calls.createVolume.push(args)
                                return {
                                    id: 999,
                                    size: 20,
                                    location: 'fsn1'
                                }
                            }
                        }) as any,
                    cloudflare: {
                        async createDNSRecord(subdomain, ip) {
                            calls.createDnsRecord.push([subdomain, ip])
                            return {
                                id: 'dns-existing-1',
                                name: `${subdomain}.clawhost.cloud`
                            }
                        }
                    },
                    generateSlug: () => 'should-not-run',
                    generateToken: () => 'should-not-run',
                    generateCloudInit: () => 'should-not-run',
                    encrypt: (value) => `enc:${value}`,
                    randomUUID: () => 'should-not-run'
                })
            }
        })
    )

    const signed = signPayload(subscriptionActivePayload)
    const response = await app.request('/webhooks/polar', {
        method: 'POST',
        headers: signed.headers,
        body: signed.rawPayload
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.deepEqual(body.data, { received: true })

    assert.equal(provisionCalls, 0)
    assert.equal(db.state.deletedPendingClaws.length, 0)
    assert.equal(db.state.insertedClaws.length, 0)
    assert.equal(db.state.insertedVolumes.length, 0)
    assert.equal(db.state.clawUpdates.length, 0)
    assert.equal(calls.createServer.length, 0)
    assert.equal(calls.createVolume.length, 0)
    assert.equal(calls.createDnsRecord.length, 0)
})

test('POST /webhooks/polar rejects invalid signature before provisioning', async () => {
    process.env.POLAR_WEBHOOK_SECRET = webhookSecret

    let provisionCalls = 0

    const app = new Hono()
    app.post(
        '/webhooks/polar',
        createHandlePolarWebhook({
            provisionClaw: async () => {
                provisionCalls += 1
                return { success: true, clawId: 'should-not-run' }
            }
        })
    )

    const signed = signPayload(checkoutUpdatedPayload)
    const response = await app.request('/webhooks/polar', {
        method: 'POST',
        headers: {
            ...signed.headers,
            'webhook-signature': 'v1,totally-wrong'
        },
        body: signed.rawPayload
    })

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.success, false)
    assert.equal(provisionCalls, 0)
})