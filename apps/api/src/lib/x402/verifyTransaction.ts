import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { payments, claws } from '@/db/schema'
import {
    USDC_BASE_ADDRESS,
    PAY_TO_ADDRESS,
    AMOUNT_TOLERANCE,
    TRANSFER_EVENT_TOPIC,
    USDC_DECIMALS
} from './constants'

const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org'

export interface VerifyResult {
    valid: boolean
    error?: string
    confirmedAmount?: number
}

/**
 * Verify a USDC transfer transaction on Base.
 * Checks: correct recipient, correct token, sufficient amount, finalized.
 */
export async function verifyTransaction(
    paymentId: string,
    txHash: string
): Promise<VerifyResult> {
    // 0. Check for txHash replay
    const [existingTx] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.txHash, txHash))
        .limit(1)

    if (existingTx) return { valid: false, error: 'Transaction hash already used' }

    // 1. Get payment record
    const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1)

    if (!payment) return { valid: false, error: 'Payment not found' }
    if (payment.status === 'confirmed') return { valid: false, error: 'Already confirmed' }
    if (payment.status === 'expired') return { valid: false, error: 'Payment expired' }

    // 2. Fetch transaction receipt from Base RPC
    const receipt = await fetchTransactionReceipt(txHash)
    if (!receipt) return { valid: false, error: 'Transaction not found or not finalized' }
    if (receipt.status !== '0x1') return { valid: false, error: 'Transaction failed' }

    // 3. Find USDC Transfer event to our address
    const transferLog = receipt.logs.find((log: any) =>
        log.address.toLowerCase() === USDC_BASE_ADDRESS.toLowerCase() &&
        log.topics[0] === TRANSFER_EVENT_TOPIC &&
        log.topics[2] && // to address
        '0x' + log.topics[2].slice(26).toLowerCase() === PAY_TO_ADDRESS.toLowerCase()
    )

    if (!transferLog) return { valid: false, error: 'No USDC transfer to payment address found' }

    // 4. Check amount
    const transferredAmount = parseInt(transferLog.data, 16)
    if (transferredAmount < payment.expectedAmount - AMOUNT_TOLERANCE) {
        return { valid: false, error: `Insufficient amount: expected ${payment.expectedAmount}, got ${transferredAmount}` }
    }

    // 5. Confirm payment
    await db.update(payments).set({
        status: 'confirmed',
        txHash,
        fromAddress: '0x' + transferLog.topics[1].slice(26),
        amountUsdc: transferredAmount,
        confirmedAt: new Date()
    }).where(eq(payments.id, paymentId))

    // 6. Update claw paidUntil if linked
    if (payment.clawId) {
        const monthsToAdd = payment.billingMonths
        const currentPaidUntil = await getCurrentPaidUntil(payment.clawId)
        const startDate = currentPaidUntil > new Date() ? currentPaidUntil : new Date()
        const newPaidUntil = new Date(startDate)
        newPaidUntil.setMonth(newPaidUntil.getMonth() + monthsToAdd)

        await db.update(claws).set({
            paidUntil: newPaidUntil,
            subscriptionStatus: 'active'
        }).where(eq(claws.id, payment.clawId))
    }

    return { valid: true, confirmedAmount: transferredAmount }
}

async function fetchTransactionReceipt(txHash: string): Promise<any> {
    const resp = await fetch(BASE_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionReceipt',
            params: [txHash]
        })
    })
    const data = await resp.json() as any
    return data.result
}

async function getCurrentPaidUntil(clawId: string): Promise<Date> {
    const [claw] = await db.select().from(claws).where(eq(claws.id, clawId)).limit(1)
    return claw?.paidUntil ?? new Date()
}