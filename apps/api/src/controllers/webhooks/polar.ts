import type { Context } from 'hono'
import type {
    SubscriptionWebhookData,
    CheckoutWebhookData
} from '@/ts/Interfaces'
import type { ProviderType } from '@/ts/Types'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { claws } from '@/db/schema'
import { parseWebhook, handleWebhook } from '@/lib/polar'
import { provisionClaw } from '@/controllers/claws/provisionClaw'
import { getProvider } from '@/services/provider'
import { cleanupClaw } from '@/controllers/claws/helpers'
import { ok, fail } from '@/lib/response'
import * as i18nModule from '@openclaw/i18n'

type PolarWebhookDeps = {
    parseWebhook: typeof parseWebhook
    handleWebhook: typeof handleWebhook
    provisionClaw: typeof provisionClaw
    db: typeof db
    getProvider: typeof getProvider
    cleanupClaw: typeof cleanupClaw
    ok: typeof ok
    fail: typeof fail
}

const { t } = ('default' in i18nModule ? i18nModule.default : i18nModule) as {
    t: (key: Parameters<typeof import('@openclaw/i18n').t>[0]) => string
}

const defaultDeps: PolarWebhookDeps = {
    parseWebhook,
    handleWebhook,
    provisionClaw,
    db,
    getProvider,
    cleanupClaw,
    ok,
    fail
}

async function attemptProvision(
    deps: PolarWebhookDeps,
    params: {
        pendingClawId?: string
        subscriptionId?: string
        customerId?: string
        productId?: string
        source: string
    }
) {
    const { pendingClawId, subscriptionId, customerId, productId, source } =
        params

    if (!pendingClawId || !subscriptionId || !customerId || !productId) {
        console.warn(`[polar webhook] skip provision from ${source}`, {
            pendingClawId,
            subscriptionId,
            customerId,
            productId
        })
        return
    }

    const result = await deps.provisionClaw({
        pendingClawId,
        subscriptionId,
        customerId,
        productId
    })

    if (!result.success) {
        console.error(`[polar webhook] provision failed from ${source}:`, result)
    }
}

export const createHandlePolarWebhook = (
    overrides: Partial<PolarWebhookDeps> = {}
) => {
    const deps = { ...defaultDeps, ...overrides }

    return async (c: Context) => {
        try {
            const event = await deps.parseWebhook(c)

            if (!event) {
                return deps.fail(c, t('api.invalidWebhook'), 400)
            }

            await deps.handleWebhook(event, {
                onCheckoutUpdated: async (data: CheckoutWebhookData) => {
                    if (data.status !== 'succeeded') {
                        return
                    }

                    await attemptProvision(deps, {
                        pendingClawId: data.metadata?.pendingClawId,
                        subscriptionId: data.subscriptionId,
                        customerId: data.customerId,
                        productId: data.productId,
                        source: 'checkout.updated'
                    })
                },

                onSubscriptionActive: async (data: SubscriptionWebhookData) => {
                    const existingClaw = await deps.db
                        .select()
                        .from(claws)
                        .where(eq(claws.polarSubscriptionId, data.id))
                        .limit(1)

                    if (existingClaw[0]) {
                        return
                    }

                    await attemptProvision(deps, {
                        pendingClawId: data.metadata?.pendingClawId,
                        subscriptionId: data.id,
                        customerId: data.customerId,
                        productId: data.productId,
                        source: 'subscription.active'
                    })
                },

                onSubscriptionCanceled: async (
                    data: SubscriptionWebhookData
                ) => {
                    const deletionScheduledAt = data.currentPeriodEnd
                        ? new Date(data.currentPeriodEnd)
                        : null

                    await deps.db
                        .update(claws)
                        .set({
                            subscriptionStatus: 'canceled',
                            ...(deletionScheduledAt
                                ? { deletionScheduledAt }
                                : {})
                        })
                        .where(eq(claws.polarSubscriptionId, data.id))
                },

                onSubscriptionRevoked: async (data: SubscriptionWebhookData) => {
                    const claw = await deps.db
                        .select()
                        .from(claws)
                        .where(eq(claws.polarSubscriptionId, data.id))
                        .limit(1)

                    if (!claw[0]) {
                        return
                    }

                    if (claw[0].deletionScheduledAt) {
                        try {
                            await deps.cleanupClaw(claw[0].id, {
                                provider: (claw[0].provider ||
                                    'hetzner') as ProviderType,
                                providerServerId: claw[0].providerServerId,
                                subdomain: claw[0].subdomain
                            })
                        } catch (err) {
                            console.error(
                                `Failed to cleanup claw ${claw[0].id}:`,
                                err
                            )
                            await deps.db
                                .update(claws)
                                .set({
                                    subscriptionStatus: 'revoked',
                                    status: 'stopped'
                                })
                                .where(eq(claws.id, claw[0].id))
                        }
                        return
                    }

                    await deps.db
                        .update(claws)
                        .set({ subscriptionStatus: 'revoked' })
                        .where(eq(claws.id, claw[0].id))

                    if (claw[0].providerServerId) {
                        try {
                            const provider = deps.getProvider(
                                (claw[0].provider || 'hetzner') as ProviderType
                            )
                            await provider.stopServer(claw[0].providerServerId)
                            await deps.db
                                .update(claws)
                                .set({ status: 'stopped' })
                                .where(eq(claws.id, claw[0].id))
                        } catch (err) {
                            console.error(`Failed to stop server: ${err}`)
                        }
                    }
                },

                onSubscriptionUncanceled: async (
                    data: SubscriptionWebhookData
                ) => {
                    await deps.db
                        .update(claws)
                        .set({
                            deletionScheduledAt: null,
                            subscriptionStatus: 'active'
                        })
                        .where(eq(claws.polarSubscriptionId, data.id))
                },

                onSubscriptionUpdated: async (data: SubscriptionWebhookData) => {
                    await deps.db
                        .update(claws)
                        .set({ subscriptionStatus: data.status })
                        .where(eq(claws.polarSubscriptionId, data.id))

                    if (data.status === 'past_due') {
                        const claw = await deps.db
                            .select()
                            .from(claws)
                            .where(eq(claws.polarSubscriptionId, data.id))
                            .limit(1)

                        if (claw[0]?.providerServerId) {
                            try {
                                const provider = deps.getProvider(
                                    (claw[0].provider ||
                                        'hetzner') as ProviderType
                                )
                                await provider.stopServer(
                                    claw[0].providerServerId
                                )
                                await deps.db
                                    .update(claws)
                                    .set({ status: 'stopped' })
                                    .where(eq(claws.id, claw[0].id))
                            } catch (err) {
                                console.error(`Failed to stop server: ${err}`)
                            }
                        }
                    }
                }
            })

            return deps.ok(c, { received: true }, t('api.webhookReceived'))
        } catch (err) {
            console.error('Webhook error:', err)
            return deps.fail(c, t('api.webhookProcessingFailed'), 500)
        }
    }
}

const handlePolarWebhook = createHandlePolarWebhook()

export default handlePolarWebhook