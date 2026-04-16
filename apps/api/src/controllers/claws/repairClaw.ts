import type { Context } from 'hono'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { claws } from '@/db/schema'
import executeSSH from '@/services/ssh'
import { isAdmin } from '@/controllers/claws/helpers'
import { t } from '@openclaw/i18n'
import { ok, fail } from '@/lib/response'
import { decrypt } from '@/lib/crypto'

const repairClaw = async (c: Context<{ Variables: { userId: string } }>) => {
    try {
        const userId = c.get('userId')
        const id = c.req.param('id')
        const admin = await isAdmin(userId)

        if (!admin) {
            return fail(c, t('api.adminAccessDenied'), 403)
        }

        const claw = await db
            .select()
            .from(claws)
            .where(eq(claws.id, id))
            .limit(1)

        if (!claw[0]) {
            return fail(c, t('api.clawNotFound'), 404)
        }

        if (!claw[0].ip || !claw[0].rootPassword) {
            return fail(c, t('api.failedToRepairClaw'), 400)
        }

        const repairCommands = [
            "sed -i '/NODE_OPTIONS/d' /etc/systemd/system/openclaw-gateway.service",
            "grep -q 'StartLimitIntervalSec' /etc/systemd/system/openclaw-gateway.service || sed -i '/RestartSec=/a\\    StartLimitIntervalSec=0' /etc/systemd/system/openclaw-gateway.service",
            'rm -f /etc/cron.d/openclaw-watchdog',
            'rm -f /usr/local/bin/openclaw-watchdog.sh',
            'mkdir -p /etc/systemd/system/nginx.service.d',
            "printf '[Service]\\nRestart=always\\nRestartSec=5\\n' > /etc/systemd/system/nginx.service.d/override.conf",
            'systemctl daemon-reload',
            'openclaw doctor --fix || true',
            'systemctl restart openclaw-gateway',
            'sleep 10',
            'curl -sf -o /dev/null --max-time 5 http://127.0.0.1:18789 && echo "GATEWAY_OK" || echo "GATEWAY_FAILED"'
        ].join(' && ')

        const output = await executeSSH(
            claw[0].ip,
            decrypt(claw[0].rootPassword),
            repairCommands,
            30000
        )
        const success = output.includes('GATEWAY_OK')

        if (success && claw[0].status === 'configuring') {
            await db
                .update(claws)
                .set({ status: 'running' })
                .where(eq(claws.id, id))
        }

        if (success) {
            return ok(c, null, t('api.repairSuccess'))
        }

        return fail(c, t('api.repairGatewayNotResponding'), 500)
    } catch (err) {
        console.error('Repair claw error:', err)
        return fail(
            c,
            err instanceof Error
                ? err.message
                : t('api.failedToRepairClaw'),
            500
        )
    }
}

export default repairClaw