import type { Context } from 'hono'
import type { InitiateClawPurchaseBody } from '@/ts/Interfaces'
import type { ProviderType } from '@/ts/Types'

import { eq, and, count, lt } from 'drizzle-orm'
import { db } from '@/db'
import { users, sshKeys, claws, pendingClaws } from '@/db/schema'
import { checkouts, customers } from '@/lib/polar'
import { generatePassword } from '@/controllers/claws/helpers'
import { getProvider } from '@/services/provider'
import { t } from '@openclaw/i18n'
import { ok, fail } from '@/lib/response'

const adjectives = [
    'cozy',
    'swift',
    'brave',
    'calm',
    'tiny',
    'wild',
    'warm',
    'cool',
    'happy',
    'lucky',
    'fuzzy',
    'snowy',
    'dusty',
    'misty',
    'sunny',
    'sleepy',
    'clever',
    'gentle',
    'mighty',
    'silent',
    'golden',
    'cosmic',
    'polar',
    'rusty',
    'nimble',
    'jolly',
    'witty',
    'noble',
    'vivid',
    'crisp'
]

const nouns = [
    'claw',
    'panda',
    'otter',
    'fox',
    'wolf',
    'bear',
    'falcon',
    'lynx',
    'raven',
    'crane',
    'pike',
    'owl',
    'hare',
    'frog',
    'moth',
    'finch',
    'cedar',
    'maple',
    'birch',
    'reef',
    'dune',
    'peak',
    'brook',
    'grove',
    'ember',
    'spark',
    'drift',
    'frost',
    'cloud',
    'storm'
]

let lastPendingCleanup = 0
const CLEANUP_INTERVAL = 60 * 60 * 1000

let namePool: string[] = []

function shufflePool() {
    namePool = []
    for (const adj of adjectives) {
        for (const noun of nouns) {
            namePool.push(`${adj}-${noun}`)
        }
    }
    for (let i = namePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[namePool[i], namePool[j]] = [namePool[j], namePool[i]]
    }
}

function generateClawName(): string {
    if (namePool.length === 0) {
        shufflePool()
    }
    return namePool.pop()!
}

function getPolarProductId(
    providerName: string,
    planId: string
): string | null {
    const prefix =
        providerName === 'hetzner' ? '' : `${providerName.toUpperCase()}_`
    const envKey = `POLAR_PRODUCT_${prefix}${planId.toUpperCase().replace(/-/g, '_')}`
    const envValue = process.env[envKey]

    if (envValue) return envValue
    else return null
}

const initiateClawPurchase = async (
    c: Context<{ Variables: { userId: string } }>
) => {
    try {
        if (Date.now() - lastPendingCleanup > CLEANUP_INTERVAL) {
            await db
                .delete(pendingClaws)
                .where(lt(pendingClaws.expiresAt, new Date()))
            lastPendingCleanup = Date.now()
        }

        const userId = c.get('userId')
        const {
            name: rawName,
            provider: providerName,
            planId,
            location,
            password,
            sshKeyId,
            volumeSize,
            model,
            apiToken,
            priceMonthly
        } = await c.req.json<InitiateClawPurchaseBody>()

        if (!planId || !location || priceMonthly === undefined) {
            return fail(c, t('api.missingRequiredFields'), 400)
        }

        const validProviders: ProviderType[] = [
            'hetzner',
            'digitalocean',
            'vultr'
        ]
        if (
            providerName &&
            !validProviders.includes(providerName as ProviderType)
        ) {
            return fail(c, t('api.invalidProvider'), 400)
        }

        const normalizedProvider = (providerName || 'hetzner') as ProviderType
        const provider = getProvider(normalizedProvider)
        const [serverTypes, locations] = await Promise.all([
            provider.getServerTypes(),
            provider.getLocations()
        ])

        const MIN_MEMORY_GB = 4
        const selectedPlan = serverTypes.find((st) => st.name === planId)

        if (!selectedPlan) {
            return fail(c, t('api.invalidPlan'), 400)
        }

        if (selectedPlan.memory < MIN_MEMORY_GB) {
            return fail(c, t('api.planBelowMinimumMemory'), 400)
        }

        const normalizedPriceMonthly = Number(selectedPlan.priceMonthly.toFixed(2))
        if (Math.abs(priceMonthly - normalizedPriceMonthly) > 0.01) {
            return fail(c, t('api.invalidPlan'), 400)
        }

        const selectedLocation = locations.find((l) => l.id === location)
        if (!selectedLocation || selectedLocation.disabled) {
            return fail(c, t('api.invalidLocation'), 400)
        }

        const MAX_CLAWS_PER_ACCOUNT = 50
        const [{ value: clawCount }] = await db
            .select({ value: count() })
            .from(claws)
            .where(eq(claws.userId, userId))

        if (clawCount >= MAX_CLAWS_PER_ACCOUNT) {
            return fail(c, t('api.clawLimitReached'), 400)
        }

        const name = rawName || generateClawName()

        if (
            volumeSize !== undefined &&
            (volumeSize < 10 || volumeSize > 10240)
        ) {
            return fail(c, t('api.volumeSizeInvalid'), 400)
        }

        const user = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)

        if (!user[0]) {
            return fail(c, t('api.userNotFound'), 404)
        }

        if (sshKeyId) {
            const sshKey = await db
                .select()
                .from(sshKeys)
                .where(
                    and(eq(sshKeys.id, sshKeyId), eq(sshKeys.userId, userId))
                )
                .limit(1)

            if (!sshKey[0]) {
                return fail(c, t('api.sshKeyNotFound'), 404)
            }
        }

        let polarCustomerId = user[0].polarCustomerId

        if (!polarCustomerId) {
            const customer = await customers.getOrCreate({
                email: user[0].email,
                name: user[0].name || undefined,
                externalId: userId
            })
            polarCustomerId = customer.id

            await db
                .update(users)
                .set({ polarCustomerId })
                .where(eq(users.id, userId))
        }

        const productId = getPolarProductId(normalizedProvider, planId)
        if (!productId) {
            return fail(c, t('api.paymentNotConfigured'), 400)
        }

        const pendingId = crypto.randomUUID()
        const finalPassword = password || generatePassword()
        const priceMonthlyCents = Math.round(normalizedPriceMonthly * 100)

        const checkout = await checkouts.create({
            productId,
            customerEmail: user[0].email,
            customerId: polarCustomerId,
            metadata: {
                pendingClawId: pendingId,
                userId,
                provider: normalizedProvider,
                planId,
                location,
                name,
                sshKeyId: sshKeyId || '',
                volumeSize: volumeSize?.toString() || '',
                model: model || '',
                priceMonthly: priceMonthlyCents.toString()
            }
        })

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

        await db.insert(pendingClaws).values({
            id: pendingId,
            userId,
            checkoutId: checkout.id,
            name,
            provider: normalizedProvider,
            planId,
            location,
            rootPassword: finalPassword,
            sshKeyId: sshKeyId || null,
            volumeSize: volumeSize || null,
            model: model || null,
            apiToken: apiToken || null,
            priceMonthly: priceMonthlyCents,
            expiresAt
        })

        return ok(
            c,
            {
                checkoutUrl: checkout.url,
                checkoutId: checkout.id,
                pendingClawId: pendingId,
                expiresAt: expiresAt.toISOString(),
                priceMonthly: normalizedPriceMonthly
            },
            t('api.clawPurchaseInitiated')
        )
    } catch (err) {
        console.error('Initiate claw purchase error:', err)
        return fail(
            c,
            err instanceof Error
                ? err.message
                : t('api.failedToInitiatePurchase'),
            500
        )
    }
}

export default initiateClawPurchase