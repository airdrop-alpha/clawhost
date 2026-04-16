import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

// Admin user IDs whitelist (Firebase UIDs)
const ADMIN_WHITELIST = new Set(
    (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean)
)

const isAdmin = async (userId: string): Promise<boolean> => {
    // Check whitelist first (most secure)
    if (ADMIN_WHITELIST.size > 0 && !ADMIN_WHITELIST.has(userId)) {
        return false
    }

    const user = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

    return user[0]?.role === 'admin'
}

export default isAdmin