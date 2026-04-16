import { lt, eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { payments, claws } from '@/db/schema'
import { GRACE_PERIOD_DAYS, DELETION_DELAY_DAYS } from './constants'

/**
 * Mark expired pending payments.
 * Run periodically (e.g. every hour).
 */
export async function checkExpiredPayments(): Promise<number> {
    const result = await db
        .update(payments)
        .set({ status: 'expired' })
        .where(
            and(
                eq(payments.status, 'pending'),
                lt(payments.expiresAt, new Date())
            )
        )
        .returning()

    return result.length
}

/**
 * Check for claws past their paidUntil date.
 * Suspend after grace period, schedule deletion after further delay.
 */
export async function checkExpiredSubscriptions(): Promise<void> {
    const now = new Date()
    const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    const deletionCutoff = new Date(now.getTime() - (GRACE_PERIOD_DAYS + DELETION_DELAY_DAYS) * 24 * 60 * 60 * 1000)

    // Suspend claws past grace period
    await db
        .update(claws)
        .set({ subscriptionStatus: 'suspended' })
        .where(
            and(
                eq(claws.subscriptionStatus, 'active'),
                lt(claws.paidUntil, graceCutoff)
            )
        )

    // Schedule deletion for long-overdue claws
    await db
        .update(claws)
        .set({
            subscriptionStatus: 'deleting',
            deletionScheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
        })
        .where(
            and(
                eq(claws.subscriptionStatus, 'suspended'),
                lt(claws.paidUntil, deletionCutoff)
            )
        )
}