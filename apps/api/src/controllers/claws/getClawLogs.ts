import type { Context } from 'hono'

import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { claws } from '@/db/schema'
import executeSSH from '@/services/ssh'
import { isAdmin } from '@/controllers/claws/helpers'
import { t } from '@openclaw/i18n'
import { ok, fail } from '@/lib/response'
import { decrypt } from '@/lib/crypto'

const getClawLogs = async (c: Context<{ Variables: { userId: string } }>) => {
    try {
        const userId = c.get('userId')
        const id = c.req.param('id')
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

        if (!claw[0].ip || !claw[0].rootPassword) {
            return fail(c, t('api.failedToGetDiagnostics'), 400)
        }

        const output = await executeSSH(
            claw[0].ip,
            decrypt(claw[0].rootPassword),
            'tail -100 /var/log/openclaw-gateway.log 2>&1'
        )

        return ok(c, { logs: output }, t('api.logsFetched'))
    } catch (err) {
        console.error('Get claw logs error:', err)
        return fail(
            c,
            err instanceof Error
                ? err.message
                : t('api.failedToGetDiagnostics'),
            500
        )
    }
}

export default getClawLogs