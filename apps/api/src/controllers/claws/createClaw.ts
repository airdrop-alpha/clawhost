import type { Context } from 'hono'
import type { CreateClawBody } from '@/ts/Interfaces'

import { eq, and, count } from 'drizzle-orm'
import { db } from '@/db'
import { claws, sshKeys, volumes } from '@/db/schema'
import { getProvider } from '@/services/provider'
import { cloudflare } from '@/services/cloudflare'
import {
    generateSlug,
    generatePassword,
    generateCloudInit,
    generateToken,
    DOMAIN
} from '@/controllers/claws/helpers'
import { ok, fail } from '@/lib/response'
import { encrypt } from '@/lib/crypto'
import { t } from '@openclaw/i18n'

const createClaw = async (c: Context<{ Variables: { userId: string } }>) => {
    try {
        const userId = c.get('userId')
        const {
            name,
            provider: providerName,
            planId,
            location,
            password,
            sshKeyId,
            volumeSize,
            model,
            apiToken
        } = await c.req.json<CreateClawBody>()

        if (!name || !planId || !location) {
            return fail(c, t('api.missingRequiredFields'), 400)
        }

        const MAX_CLAWS_PER_ACCOUNT = 50
        const [{ value: clawCount }] = await db
            .select({ value: count() })
            .from(claws)
            .where(eq(claws.userId, userId))

        if (clawCount >= MAX_CLAWS_PER_ACCOUNT) {
            return fail(c, t('api.clawLimitReached'), 400)
        }

        if (
            volumeSize !== undefined &&
            (volumeSize < 10 || volumeSize > 10240)
        ) {
            return fail(c, t('api.volumeSizeInvalid'), 400)
        }

        const provider = getProvider(providerName || 'hetzner')

        const MIN_MEMORY_GB = 4
        const serverTypes = await provider.getServerTypes()
        const selectedPlan = serverTypes.find((st) => st.name === planId)

        if (!selectedPlan) {
            return fail(c, t('api.invalidPlan'), 400)
        }

        if (selectedPlan.memory < MIN_MEMORY_GB) {
            return fail(c, t('api.planBelowMinimumMemory'), 400)
        }

        const id = crypto.randomUUID()
        const subdomain = generateSlug(id)
        const finalPassword = password || generatePassword()

        let providerSshKeyIds: number[] | undefined
        if (sshKeyId) {
            const sshKey = await db
                .select()
                .from(sshKeys)
                .where(
                    and(eq(sshKeys.id, sshKeyId), eq(sshKeys.userId, userId))
                )
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

        const gatewayToken = generateToken()
        const cloudInitScript = generateCloudInit(
            finalPassword,
            subdomain,
            DOMAIN,
            gatewayToken,
            model || undefined,
            apiToken || undefined
        )

        const { serverId, ip } = await provider.createServer(
            `${name}-${id.slice(0, 8)}`,
            planId,
            location,
            finalPassword,
            providerSshKeyIds,
            '',
            cloudInitScript
        )

        try {
            await cloudflare.createDNSRecord(subdomain, ip)
        } catch (dnsErr) {
            console.error('Failed to create DNS record:', dnsErr)
        }

        await db.insert(claws).values({
            id,
            userId,
            name,
            provider: providerName || 'hetzner',
            providerServerId: serverId.toString(),
            status: 'configuring',
            ip,
            planId,
            location,
            rootPassword: encrypt(finalPassword),
            sshKeyId: sshKeyId || null,
            subdomain,
            gatewayToken: encrypt(gatewayToken),
            model: model || null
        })

        let createdVolume = null
        if (volumeSize && volumeSize >= 10) {
            try {
                const volumeId = crypto.randomUUID()
                const providerVolume = await provider.createVolume(
                    `${name}-vol-${volumeId.slice(0, 8)}`,
                    volumeSize,
                    location,
                    serverId
                )

                await db.insert(volumes).values({
                    id: volumeId,
                    userId,
                    clawId: id,
                    name: `${name}-storage`,
                    size: volumeSize,
                    providerVolumeId: providerVolume.id,
                    location,
                    status: 'available'
                })

                createdVolume = {
                    id: volumeId,
                    size: volumeSize,
                    name: `${name}-storage`
                }
            } catch (volumeErr) {
                console.error('Failed to create volume:', volumeErr)
            }
        }

        return ok(c, {
            id,
            name,
            provider: providerName || 'hetzner',
            status: 'configuring',
            ip,
            planId,
            location,
            subdomain,
            url: `https://${subdomain}.${DOMAIN}`,
            createdAt: new Date().toISOString(),
            rootPassword: finalPassword,
            gatewayToken,
            volume: createdVolume
        }, t('api.clawCreated'))
    } catch (err) {
        console.error('Create claw error:', err)
        return fail(c, err instanceof Error ? err.message : t('api.failedToCreateClaw'), 500)
    }
}

export default createClaw