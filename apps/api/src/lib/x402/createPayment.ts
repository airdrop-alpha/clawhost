import { db } from '@/db'
import { payments } from '@/db/schema'
import { calculatePrice } from './pricing'
import { PAY_TO_ADDRESS, PAYMENT_EXPIRY_HOURS } from './constants'

export interface CreatePaymentParams {
    userId: string
    clawId?: string
    planId: string
    monthlyPriceUsd: number
    billingMonths: 1 | 3 | 6 | 12
}

export interface CreatePaymentResult {
    paymentId: string
    payToAddress: string
    amountUsdc: number        // atomic units
    amountDisplay: string     // human readable e.g. "5.99"
    reference: string
    expiresAt: Date
    billingMonths: number
    discountPercent: number
}

/**
 * Create a pending payment record.
 * Returns payment details for the frontend to display.
 */
export async function createPayment(
    params: CreatePaymentParams
): Promise<CreatePaymentResult> {
    const { totalUsdc, discountPercent } = calculatePrice(
        params.monthlyPriceUsd,
        params.billingMonths
    )

    const id = crypto.randomUUID()
    const reference = generateReference()
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_HOURS * 60 * 60 * 1000)

    await db.insert(payments).values({
        id,
        userId: params.userId,
        clawId: params.clawId || null,
        amountUsdc: totalUsdc,
        billingMonths: params.billingMonths,
        expectedAmount: totalUsdc,
        reference,
        status: 'pending',
        expiresAt
    })

    return {
        paymentId: id,
        payToAddress: PAY_TO_ADDRESS,
        amountUsdc: totalUsdc,
        amountDisplay: (totalUsdc / 1e6).toFixed(2),
        reference,
        expiresAt,
        billingMonths: params.billingMonths,
        discountPercent
    }
}

function generateReference(): string {
    // 8-char hex reference for easy identification
    const bytes = new Uint8Array(4)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}