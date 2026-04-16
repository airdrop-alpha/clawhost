import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { verifyToken } from '@/services/firebase'
import { db } from '@/db'
import { users } from '@/db/schema'
import { ok, fail } from '@/lib/response'
import { t } from '@openclaw/i18n'
import {
    authRoutes,
    clawsRoutes,
    plansRoutes,
    sshKeysRoutes,
    usersRoutes,
    webhooksRoutes
} from '@/routes'
import { globalRateLimit } from '@/middleware/rateLimiter'

const app = new Hono<{ Variables: { userId: string } }>()

app.use('*', logger())
const corsOrigins = process.env.NODE_ENV === 'production'
    ? ['https://clawhost.cloud', 'https://www.clawhost.cloud']
    : ['https://clawhost.cloud', 'https://www.clawhost.cloud', 'http://localhost:1111', 'http://localhost:3000']

app.use(
    '*',
    cors({
        origin: corsOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400
    })
)

app.use('*', globalRateLimit)

app.get('/', (c) => ok(c, null, t('api.healthOk')))

app.route('/auth', authRoutes)
app.route('/plans', plansRoutes)
app.route('/webhooks', webhooksRoutes)

app.use('/*', async (c, next) => {
    if (
        c.req.path === '/' ||
        c.req.path.startsWith('/favicon') ||
        c.req.path.startsWith('/auth') ||
        c.req.path.startsWith('/plans') ||
        c.req.path.startsWith('/webhooks')
    ) {
        return next()
    }

    try {
        const authHeader = c.req.header('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return fail(c, t('api.unauthorized'), 401)
        }

        const token = authHeader.slice(7)
        const decoded = await verifyToken(token)

        if (!decoded) {
            return fail(c, t('api.invalidToken'), 401)
        }

        await db
            .insert(users)
            .values({
                id: decoded.uid,
                email: decoded.email || ''
            })
            .onConflictDoUpdate({
                target: users.email,
                set: { id: decoded.uid }
            })

        c.set('userId', decoded.uid)
        return next()
    } catch (err) {
        console.error('Auth middleware error:', err)
        return fail(c, t('api.internalServerError'), 500)
    }
})

app.route('/claws', clawsRoutes)
app.route('/ssh-keys', sshKeysRoutes)
app.route('/users', usersRoutes)

app.notFound((c) => fail(c, t('api.notFound'), 404))

export default app