import type { Context } from 'hono'
import type { ProviderType } from '@/ts/Types'

import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { claws } from '@/db/schema'
import { getProvider } from '@/services/provider'
import { isAdmin } from '@/controllers/claws/helpers'
import { ok, fail } from '@/lib/response'
import { t } from '@openclaw/i18n'

const getClaw = async (c: Context<{ Variables: { userId: string } }>) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const sync = c.req.query('sync') === 'true'
    const admin = await isAdmin(userId)

    const claw = await db
        .select()
        .from(claws)
        .where(
            admin
                ? eq(claws.id, id)
                : and(eq(claws.id, id), eq(claws.userId, userId))
        )
        .limit(1)

    if (!claw[0]) {
        return fail(c, t('api.clawNotFound'), 404)
    }

    if (sync && claw[0].providerServerId) {
        try {
            const provider = getProvider(claw[0].provider as ProviderType)
            const serverStatus = await provider.getServer(
                claw[0].providerServerId
            )
            if (
                serverStatus.status !== claw[0].status ||
                serverStatus.ip !== claw[0].ip
            ) {
                await db
                    .update(claws)
                    .set({ status: serverStatus.status, ip: serverStatus.ip })
                    .where(eq(claws.id, id))
                const { rootPassword: _rp, gatewayToken: _gt, ...safeSynced } = claw[0]
                return ok(c, {
                    ...safeSynced,
                    status: serverStatus.status,
                    ip: serverStatus.ip
                }, t('api.clawFetched'))
            }
        } catch (err) {
            console.error('Failed to sync server status:', err)
        }
    }

    const { rootPassword, gatewayToken, ...safeClaw } = claw[0]
    return ok(c, safeClaw, t('api.clawFetched'))
}

export default getClaw