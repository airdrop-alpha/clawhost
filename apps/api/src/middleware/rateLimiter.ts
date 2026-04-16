import type { Context, Next } from 'hono'
import { fail } from '@/lib/response'

/**
 * Simple in-memory rate limiter.
 * For production at scale, replace with Redis-backed solution.
 */
const windowMap = new Map<string, { count: number; resetAt: number }>()

// Cleanup stale entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, val] of windowMap) {
        if (val.resetAt <= now) windowMap.delete(key)
    }
}, 5 * 60 * 1000)

interface RateLimitOptions {
    windowMs: number
    max: number
    keyPrefix?: string
}

function getClientKey(c: Context): string {
    // Prefer userId if authenticated, fallback to IP
    try {
        const userId = c.get('userId')
        if (userId) return `user:${userId}`
    } catch { /* not authenticated yet */ }
    return `ip:${c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'}`
}

export function rateLimiter(opts: RateLimitOptions) {
    return async (c: Context, next: Next) => {
        const key = `${opts.keyPrefix || 'rl'}:${getClientKey(c)}`
        const now = Date.now()

        let entry = windowMap.get(key)
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + opts.windowMs }
            windowMap.set(key, entry)
        }

        entry.count++

        if (entry.count > opts.max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
            c.header('Retry-After', String(retryAfter))
            return fail(c, 'Rate limit exceeded. Try again later.', 429)
        }

        return next()
    }
}

/** Global: 60 req/min per client */
export const globalRateLimit = rateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: 'global'
})

/** Strict: 5 req/hour per client (for create claw) */
export const strictRateLimit = rateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyPrefix: 'strict'
})