import type { Context } from 'hono'
import type { ReadClawFileBody } from '@/ts/Interfaces'

import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { claws } from '@/db/schema'
import executeSSH from '@/services/ssh'
import { isAdmin } from '@/controllers/claws/helpers'
import { t } from '@openclaw/i18n'
import { ok, fail } from '@/lib/response'
import { decrypt } from '@/lib/crypto'

const BASE_DIR = '/home/openclaw/.openclaw'

const readClawFile = async (c: Context<{ Variables: { userId: string } }>) => {
    try {
        const userId = c.get('userId')
        const id = c.req.param('id')
        const body = await c.req.json<ReadClawFileBody>()

        if (!body.path || typeof body.path !== 'string') {
            return fail(c, t('api.missingRequiredFields'), 400)
        }

        if (body.path.includes('..') || body.path.startsWith('/')) {
            return fail(c, t('api.invalidFilePath'), 400)
        }

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
            return fail(c, t('api.failedToReadFile'), 400)
        }

        const fullPath = `${BASE_DIR}/${body.path}`
        const content = await executeSSH(
            claw[0].ip,
            decrypt(claw[0].rootPassword),
            `cat '${fullPath.replace(/'/g, "'\\''")}' 2>&1`
        )

        return ok(c, { content, path: body.path }, t('api.fileFetched'))
    } catch (err) {
        console.error('Read claw file error:', err)
        return fail(
            c,
            err instanceof Error
                ? err.message
                : t('api.failedToReadFile'),
            500
        )
    }
}

export default readClawFile