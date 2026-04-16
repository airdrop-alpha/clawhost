import test from 'node:test'
import assert from 'node:assert/strict'

import { provisionClaw } from './provisionClaw'
import { createProvisionClawTestDb } from '@/test/createProvisionClawTestDb'

test('provisionClaw claims pending claw and persists provider + DNS side effects', async () => {
    const db = createProvisionClawTestDb({
        pendingClawsById: {
            'pending-1': {
                id: 'pending-1',
                userId: 'user-1',
                name: 'Ted Claw',
                provider: 'hetzner',
                planId: 'cpx21',
                location: 'fsn1',
                rootPassword: 'root-secret',
                sshKeyId: 'ssh-1',
                volumeSize: 20,
                model: 'openai/gpt-4.1',
                tier: 'pro',
                apiToken: 'api-token'
            }
        },
        sshKeysById: {
            'ssh-1': {
                id: 'ssh-1',
                providerKeyId: 321,
                digitaloceanKeyId: 654,
                vultrKeyId: 987
            }
        }
    })

    const calls = {
        createServer: [] as any[],
        createVolume: [] as any[],
        createDnsRecord: [] as any[]
    }

    const provider = {
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
    }

    const result = await provisionClaw(
        {
            pendingClawId: 'pending-1',
            subscriptionId: 'sub-1',
            customerId: 'cus-1',
            productId: 'prod-1'
        },
        {
            db: db as any,
            getProvider: () => provider as any,
            cloudflare: {
                async createDNSRecord(subdomain, ip) {
                    calls.createDnsRecord.push([subdomain, ip])
                    return { id: 'dns-1', name: `${subdomain}.clawhost.cloud` }
                }
            },
            generateSlug: () => 'demo-slug',
            generateToken: () => 'gateway-token',
            generateCloudInit: (...args) => `cloud-init:${JSON.stringify(args)}`,
            encrypt: (value) => `enc:${value}`,
            randomUUID: (() => {
                const ids = ['claw-uuid-1', 'volume-uuid-1']
                return () => ids.shift() || 'extra-uuid'
            })()
        }
    )

    assert.deepEqual(result, { success: true, clawId: 'claw-uuid-1' })

    assert.equal(db.state.deletedPendingClaws.length, 1)
    assert.equal(db.state.deletedPendingClaws[0].id, 'pending-1')

    assert.equal(db.state.insertedClaws.length, 1)
    assert.deepEqual(db.state.insertedClaws[0], {
        id: 'claw-uuid-1',
        userId: 'user-1',
        name: 'Ted Claw',
        provider: 'hetzner',
        status: 'creating',
        planId: 'cpx21',
        location: 'fsn1',
        rootPassword: 'enc:root-secret',
        sshKeyId: 'ssh-1',
        subdomain: 'demo-slug',
        gatewayToken: 'enc:gateway-token',
        model: 'openai/gpt-4.1',
        tier: 'pro',
        polarSubscriptionId: 'sub-1',
        polarProductId: 'prod-1',
        polarCustomerId: 'cus-1',
        subscriptionStatus: 'active'
    })

    assert.deepEqual(calls.createServer[0], [
        'Ted Claw-claw-uui',
        'cpx21',
        'fsn1',
        'root-secret',
        [321],
        '',
        'cloud-init:["root-secret","demo-slug","clawhost.cloud","gateway-token","openai/gpt-4.1","api-token","pro"]'
    ])

    assert.deepEqual(calls.createDnsRecord, [['demo-slug', '203.0.113.10']])
    assert.deepEqual(db.state.clawUpdates, [
        {
            id: 'claw-uuid-1',
            payload: {
                providerServerId: '101',
                status: 'configuring',
                ip: '203.0.113.10'
            }
        }
    ])

    assert.deepEqual(calls.createVolume[0], [
        'Ted Claw-vol-volume-u',
        20,
        'fsn1',
        101
    ])
    assert.deepEqual(db.state.insertedVolumes[0], {
        id: 'volume-uuid-1',
        userId: 'user-1',
        clawId: 'claw-uuid-1',
        name: 'Ted Claw-storage',
        size: 20,
        providerVolumeId: 202,
        location: 'fsn1',
        status: 'available'
    })
})

test('provisionClaw rolls back inserted claw if provider createServer fails', async () => {
    const db = createProvisionClawTestDb({
        pendingClawsById: {
            'pending-2': {
                id: 'pending-2',
                userId: 'user-2',
                name: 'Broken Claw',
                provider: 'hetzner',
                planId: 'cpx21',
                location: 'nbg1',
                tier: 'basic'
            }
        }
    })

    const result = await provisionClaw(
        {
            pendingClawId: 'pending-2',
            subscriptionId: 'sub-2',
            customerId: 'cus-2',
            productId: 'prod-2'
        },
        {
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
                    async createServer() {
                        throw new Error('provider boom')
                    }
                }) as any,
            cloudflare: {
                async createDNSRecord() {
                    throw new Error('should not be called')
                }
            },
            generateSlug: () => 'rollback-slug',
            generateToken: () => 'rollback-token',
            generateCloudInit: () => 'cloud-init',
            encrypt: (value) => `enc:${value}`,
            randomUUID: () => 'rollback-claw-id'
        }
    )

    assert.equal(result.success, false)
    assert.equal(result.error, 'provider boom')
    assert.deepEqual(db.state.deletedClaws, ['rollback-claw-id'])
    assert.equal(db.state.clawUpdates.length, 0)
    assert.equal(db.state.insertedVolumes.length, 0)
})