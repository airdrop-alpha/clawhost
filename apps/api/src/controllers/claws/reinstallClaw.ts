import type { Context } from 'hono'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { claws } from '@/db/schema'
import executeSSH from '@/services/ssh'
import { isAdmin } from '@/controllers/claws/helpers'
import { decrypt } from '@/lib/crypto'
import { t } from '@openclaw/i18n'
import { ok, fail } from '@/lib/response'

const reinstallClaw = async (c: Context<{ Variables: { userId: string } }>) => {
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
            return fail(c, t('api.failedToReinstallClaw'), 400)
        }

        const decryptedPassword = decrypt(claw[0].rootPassword)
        const decryptedGatewayToken = claw[0].gatewayToken ? decrypt(claw[0].gatewayToken) : ''

        const config: Record<string, unknown> = {
            gateway: {
                mode: 'local',
                auth: {
                    mode: 'token',
                    token: decryptedGatewayToken
                },
                controlUi: {
                    allowInsecureAuth: true
                },
                trustedProxies: ['127.0.0.1', '::1']
            },
            channels: {
                whatsapp: { dmPolicy: 'open', allowFrom: ['*'] },
                telegram: { dmPolicy: 'open', allowFrom: ['*'] },
                discord: {},
                slack: {},
                signal: { dmPolicy: 'open', allowFrom: ['*'] },
                imessage: { dmPolicy: 'open', allowFrom: ['*'] }
            },
            agents: {
                defaults: {
                    sandbox: { mode: 'off' },
                    ...(claw[0].model
                        ? { model: { primary: claw[0].model } }
                        : {})
                }
            }
        }

        const configJson = JSON.stringify(config, null, 2)
        const fullDomain = `${claw[0].subdomain}.clawhost.cloud`

        const configB64 = Buffer.from(configJson).toString('base64')

        const serviceFile = `[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/home/openclaw
Environment=HOME=/home/openclaw
Environment=NODE_ENV=production
ExecStart=/usr/bin/openclaw gateway --port 18789 --bind loopback
Restart=always
RestartSec=10
StartLimitIntervalSec=0
StandardOutput=append:/var/log/openclaw-gateway.log
StandardError=append:/var/log/openclaw-gateway.log

[Install]
WantedBy=multi-user.target`
        const serviceB64 = Buffer.from(serviceFile).toString('base64')

        const nginxConf = `map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${fullDomain};

    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection \\$connection_upgrade;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}`
        const nginxB64 = Buffer.from(nginxConf).toString('base64')

        const reinstallCommands = [
            'systemctl stop openclaw-gateway || true',
            'npm install -g openclaw@latest',
            `echo '${configB64}' | base64 -d > /home/openclaw/.openclaw/openclaw.json`,
            'chown -R openclaw:openclaw /home/openclaw',
            `echo '${serviceB64}' | base64 -d > /etc/systemd/system/openclaw-gateway.service`,
            `echo '${nginxB64}' | base64 -d > /etc/nginx/sites-available/openclaw`,
            'ln -sf /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/',
            'rm -f /etc/nginx/sites-enabled/default',
            'mkdir -p /etc/systemd/system/nginx.service.d',
            "printf '[Service]\\nRestart=always\\nRestartSec=5\\n' > /etc/systemd/system/nginx.service.d/override.conf",
            'systemctl daemon-reload',
            'nginx -t && systemctl reload nginx',
            'systemctl restart openclaw-gateway',
            'sleep 15',
            'curl -sf -o /dev/null --max-time 5 http://127.0.0.1:18789 && echo "GATEWAY_OK" || echo "GATEWAY_FAILED"'
        ].join(' && ')

        const output = await executeSSH(
            claw[0].ip,
            decryptedPassword,
            reinstallCommands,
            120000
        )
        const success = output.includes('GATEWAY_OK')

        if (success && claw[0].status === 'configuring') {
            await db
                .update(claws)
                .set({ status: 'running' })
                .where(eq(claws.id, id))
        }

        if (success) {
            return ok(c, null, t('api.reinstallSuccess'))
        }

        return fail(c, t('api.reinstallGatewayNotResponding'), 500)
    } catch (err) {
        console.error('Reinstall claw error:', err)
        return fail(
            c,
            err instanceof Error
                ? err.message
                : t('api.failedToReinstallClaw'),
            500
        )
    }
}

export default reinstallClaw