import type { Context } from 'hono'

import crypto from 'crypto'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { claws, clawExports } from '@/db/schema'
import sshBuffer from '@/services/sshBuffer'
import { isAdmin } from '@/controllers/claws/helpers'
import { checkRateLimit, setRateLimit } from '@/controllers/auth/rateLimit'
import { t } from '@openclaw/i18n'
import { fail } from '@/lib/response'
import { decrypt } from '@/lib/crypto'

const EXPORT_RATE_LIMIT_WINDOW = 3_600_000

const exportClaw = async (c: Context<{ Variables: { userId: string } }>) => {
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
            return fail(c, t('api.clawNotReady'), 400)
        }

        const retryAfter = await checkRateLimit(
            `export:${id}`,
            EXPORT_RATE_LIMIT_WINDOW
        )

        if (retryAfter > 3) {
            return fail(c, t('api.exportRateLimited'), 429, { retryAfter })
        }

        const buffer = await sshBuffer(
            claw[0].ip,
            decrypt(claw[0].rootPassword),
            'tar czf - -C /home/openclaw .openclaw'
        )

        await db.insert(clawExports).values({
            id: crypto.randomUUID(),
            userId,
            clawId: id,
            fileSize: buffer.length
        })

        await setRateLimit(`export:${id}`)

        const filename = `${claw[0].name}-export.tar.gz`

        return new Response(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/gzip',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        })
    } catch (err) {
        console.error('Export claw error:', err)
        return fail(
            c,
            err instanceof Error ? err.message : t('api.failedToExportClaw'),
            500
        )
    }
}

export default exportClaw