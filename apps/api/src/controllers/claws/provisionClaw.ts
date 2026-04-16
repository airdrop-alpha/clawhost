import type {
    ProvisionClawParams,
    ProvisionClawResponse,
    CloudProvider,
    CloudflareDNSRecord
} from '@/ts/Interfaces'
import type { ProviderType } from '@/ts/Types'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { claws, pendingClaws, sshKeys, volumes } from '@/db/schema'
import { getProvider } from '@/services/provider'
import { cloudflare } from '@/services/cloudflare'
import {
    generateSlug,
    generateToken,
    generateCloudInit,
    DOMAIN
} from '@/controllers/claws/helpers'
import { encrypt } from '@/lib/crypto'
import * as i18nModule from '@openclaw/i18n'

const { t } = ('default' in i18nModule ? i18nModule.default : i18nModule) as {
    t: (key: Parameters<typeof import('@openclaw/i18n').t>[0]) => string
}

export interface ProvisionClawDeps {
    db: typeof db
    getProvider: (provider: ProviderType) => CloudProvider
    cloudflare: {
        createDNSRecord: (
            subdomain: string,
            ip: string
        ) => Promise<CloudflareDNSRecord>
    }
    generateSlug: (id: string) => string
    generateToken: () => string
    generateCloudInit: typeof generateCloudInit
    encrypt: (plaintext: string) => string
    randomUUID: () => string
}

const defaultDeps: ProvisionClawDeps = {
    db,
    getProvider,
    cloudflare,
    generateSlug,
    generateToken,
    generateCloudInit,
    encrypt,
    randomUUID: () => crypto.randomUUID()
}

export async function provisionClaw(
    params: ProvisionClawParams,
    overrides: Partial<ProvisionClawDeps> = {}
): Promise<ProvisionClawResponse> {
    const deps = { ...defaultDeps, ...overrides }

    try {
        const existingClaw = await deps.db
            .select()
            .from(claws)
            .where(eq(claws.polarSubscriptionId, params.subscriptionId))
            .limit(1)

        if (existingClaw[0]) {
            return { success: true, clawId: existingClaw[0].id }
        }

        const claimed = await deps.db
            .delete(pendingClaws)
            .where(eq(pendingClaws.id, params.pendingClawId))
            .returning()

        if (!claimed[0]) {
            return { success: false, error: t('api.pendingClawNotFound') }
        }

        const pending = claimed[0]

        const providerName = (pending.provider || 'hetzner') as ProviderType
        const provider = deps.getProvider(providerName)

        const MIN_MEMORY_GB = 4
        const serverTypes = await provider.getServerTypes()
        const selectedPlan = serverTypes.find(
            (st) => st.name === pending.planId
        )

        if (!selectedPlan || selectedPlan.memory < MIN_MEMORY_GB) {
            return { success: false, error: t('api.planBelowMinimumMemory') }
        }

        const id = deps.randomUUID()
        const subdomain = deps.generateSlug(id)
        const gatewayToken = deps.generateToken()

        let providerSshKeyIds: number[] | undefined
        if (pending.sshKeyId) {
            const sshKey = await deps.db
                .select()
                .from(sshKeys)
                .where(eq(sshKeys.id, pending.sshKeyId))
                .limit(1)

            if (sshKey[0]) {
                const keyId =
                    providerName === 'digitalocean'
                        ? sshKey[0].digitaloceanKeyId
                        : providerName === 'vultr'
                          ? sshKey[0].vultrKeyId
                          : sshKey[0].providerKeyId
                if (keyId) {
                    providerSshKeyIds = [keyId]
                }
            }
        }

        const tier = (pending.tier as 'basic' | 'pro' | 'enterprise') || 'basic'
        const cloudInitScript = deps.generateCloudInit(
            pending.rootPassword || '',
            subdomain,
            DOMAIN,
            gatewayToken,
            pending.model || undefined,
            pending.apiToken || undefined,
            tier
        )

        await deps.db.insert(claws).values({
            id,
            userId: pending.userId,
            name: pending.name,
            provider: providerName,
            status: 'creating',
            planId: pending.planId,
            location: pending.location,
            rootPassword: pending.rootPassword
                ? deps.encrypt(pending.rootPassword)
                : null,
            sshKeyId: pending.sshKeyId,
            subdomain,
            gatewayToken: deps.encrypt(gatewayToken),
            model: pending.model,
            tier,
            polarSubscriptionId: params.subscriptionId,
            polarProductId: params.productId,
            polarCustomerId: params.customerId,
            subscriptionStatus: 'active'
        })

        let serverId: number
        let ip: string

        try {
            const server = await provider.createServer(
                `${pending.name}-${id.slice(0, 8)}`,
                pending.planId,
                pending.location,
                pending.rootPassword || undefined,
                providerSshKeyIds,
                '',
                cloudInitScript
            )
            serverId = server.serverId
            ip = server.ip
        } catch (providerErr) {
            await deps.db.delete(claws).where(eq(claws.id, id))
            throw providerErr
        }

        try {
            await deps.cloudflare.createDNSRecord(subdomain, ip)
        } catch (dnsErr) {
            console.error('Failed to create DNS record:', dnsErr)
        }

        await deps.db
            .update(claws)
            .set({
                providerServerId: serverId.toString(),
                status: 'configuring',
                ip
            })
            .where(eq(claws.id, id))

        if (pending.volumeSize && pending.volumeSize >= 10) {
            try {
                const volumeId = deps.randomUUID()
                const providerVolume = await provider.createVolume(
                    `${pending.name}-vol-${volumeId.slice(0, 8)}`,
                    pending.volumeSize,
                    pending.location,
                    serverId
                )

                await deps.db.insert(volumes).values({
                    id: volumeId,
                    userId: pending.userId,
                    clawId: id,
                    name: `${pending.name}-storage`,
                    size: pending.volumeSize,
                    providerVolumeId: providerVolume.id,
                    location: pending.location,
                    status: 'available'
                })
            } catch (volumeErr) {
                console.error('Failed to create volume:', volumeErr)
            }
        }

        return { success: true, clawId: id }
    } catch (err) {
        console.error('Provision claw error:', err)
        return {
            success: false,
            error:
                err instanceof Error
                    ? err.message
                    : t('api.failedToProvisionClaw')
        }
    }
}