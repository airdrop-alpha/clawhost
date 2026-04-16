import type { Context } from 'hono'

import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { claws } from '@/db/schema'
import executeSSH from '@/services/ssh'
import { isAdmin } from '@/controllers/claws/helpers'
import { t } from '@openclaw/i18n'
import { ok, fail } from '@/lib/response'
import { decrypt } from '@/lib/crypto'

const BASE_DIR = '/home/openclaw/.openclaw'

const listClawFiles = async (c: Context<{ Variables: { userId: string } }>) => {
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
            return fail(c, t('api.failedToListFiles'), 400)
        }

        const output = await executeSSH(
            claw[0].ip,
            decrypt(claw[0].rootPassword),
            `find ${BASE_DIR} -type f 2>/dev/null | sort`
        )

        const files = output
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .map((fullPath) => {
                const relativePath = fullPath.replace(`${BASE_DIR}/`, '')
                const name = relativePath.split('/').pop() || relativePath
                return {
                    path: relativePath,
                    name,
                    isJson: name.endsWith('.json')
                }
            })

        return ok(c, { files }, t('api.filesFetched'))
    } catch (err) {
        console.error('List claw files error:', err)
        return fail(
            c,
            err instanceof Error
                ? err.message
                : t('api.failedToListFiles'),
            500
        )
    }
}

export default listClawFiles