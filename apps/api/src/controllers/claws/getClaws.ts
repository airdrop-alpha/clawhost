import type { Context } from 'hono'
import type { ProviderType } from '@/ts/Types'
import type { BillingPeriod, ServerStatus } from '@/ts/Interfaces'

import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { claws, volumes } from '@/db/schema'
import { getProvider } from '@/services/provider'
import { cloudflare } from '@/services/cloudflare'
import { checkSubdomainReady } from '@/controllers/claws/helpers'
import { subscriptions } from '@/lib/polar/subscriptions'
import { ok } from '@/lib/response'
import { t } from '@openclaw/i18n'

const transitionCompletedBy: Record<string, string[]> = {
    stopping: ['off', 'stopped'],
    starting: ['running'],
    creating: ['running'],
    initializing: ['running'],
    migrating: ['running'],
    rebuilding: ['running']
}

const getClaws = async (c: Context<{ Variables: { userId: string } }>) => {
    const userId = c.get('userId')

    const [userClaws, userVolumes] = await Promise.all([
        db
            .select()
            .from(claws)
            .where(eq(claws.userId, userId))
            .orderBy(desc(claws.createdAt)),
        db.select().from(volumes).where(eq(volumes.userId, userId))
    ])

    const providers = new Set(userClaws.map((c) => c.provider as ProviderType))
    const serverMaps = new Map<ProviderType, Map<string, ServerStatus>>()

    await Promise.all(
        Array.from(providers).map(async (provider) => {
            try {
                const servers = await getProvider(provider).getServers()
                serverMaps.set(provider, servers)
            } catch (err) {
                console.error(`Failed to fetch ${provider} servers:`, err)
                serverMaps.set(provider, new Map())
            }
        })
    )

    const syncedClaws = await Promise.all(
        userClaws.map(async (claw) => {
            if (!claw.providerServerId) return claw

            const providerServers = serverMaps.get(
                claw.provider as ProviderType
            )
            if (!providerServers) return claw

            const live = providerServers.get(claw.providerServerId)
            if (!live) return claw

            if (claw.status === 'configuring') {
                if (
                    live.ip &&
                    claw.subdomain &&
                    (!claw.ip || claw.ip !== live.ip)
                ) {
                    try {
                        const existing = await cloudflare.findDNSRecord(
                            claw.subdomain
                        )
                        if (existing && existing.ip !== live.ip) {
                            await cloudflare.updateDNSRecord(
                                existing.id,
                                claw.subdomain,
                                live.ip
                            )
                        } else if (!existing) {
                            await cloudflare.createDNSRecord(
                                claw.subdomain,
                                live.ip
                            )
                        }
                    } catch {
                        console.error(`Failed to fix DNS for ${claw.subdomain}`)
                    }
                    await db
                        .update(claws)
                        .set({ ip: live.ip })
                        .where(eq(claws.id, claw.id))
                }

                if (live.status === 'running' && claw.subdomain) {
                    const ready = await checkSubdomainReady(claw.subdomain)
                    if (ready) {
                        await db
                            .update(claws)
                            .set({ status: 'running', ip: live.ip })
                            .where(eq(claws.id, claw.id))
                        return { ...claw, status: 'running', ip: live.ip }
                    }
                }
                return { ...claw, ip: live.ip }
            }

            const completionStates = transitionCompletedBy[claw.status]
            if (completionStates && !completionStates.includes(live.status)) {
                return { ...claw, ip: live.ip }
            }

            return { ...claw, status: live.status, ip: live.ip }
        })
    )

    const subIds = syncedClaws
        .filter((c) => c.polarSubscriptionId)
        .map((c) => c.polarSubscriptionId!)

    const subMap = new Map<string, BillingPeriod>()
    await Promise.all(
        subIds.map(async (id) => {
            const sub = await subscriptions.get(id)
            if (sub) {
                subMap.set(id, {
                    start: sub.currentPeriodStart?.toISOString(),
                    end: sub.currentPeriodEnd?.toISOString()
                })
            }
        })
    )

    const clawsWithVolumes = syncedClaws.map((claw) => {
        const billing = claw.polarSubscriptionId
            ? subMap.get(claw.polarSubscriptionId)
            : undefined
        const { rootPassword, gatewayToken, ...safeClaw } = claw
        return {
            ...safeClaw,
            volumes: userVolumes.filter((v) => v.clawId === claw.id),
            currentPeriodStart: billing?.start || null,
            currentPeriodEnd: billing?.end || null
        }
    })

    return ok(c, clawsWithVolumes, t('api.clawsFetched'))
}

export default getClaws