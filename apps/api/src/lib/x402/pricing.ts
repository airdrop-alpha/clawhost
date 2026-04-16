import { BILLING_DISCOUNTS, USDC_DECIMALS } from './constants'

export interface PlanPricing {
    planId: string
    monthlyPriceUsd: number // e.g. 5.99
}

/**
 * Calculate total USDC price for a billing period
 * Returns amount in atomic units (6 decimals)
 */
export function calculatePrice(
    monthlyPriceUsd: number,
    billingMonths: number
): { totalUsdc: number; discountPercent: number; monthlyEffective: number } {
    const discount = BILLING_DISCOUNTS[billingMonths] ?? 0
    const totalBeforeDiscount = monthlyPriceUsd * billingMonths
    const totalAfterDiscount = totalBeforeDiscount * (1 - discount)
    const atomicUnits = Math.round(totalAfterDiscount * 10 ** USDC_DECIMALS)

    return {
        totalUsdc: atomicUnits,
        discountPercent: discount * 100,
        monthlyEffective: totalAfterDiscount / billingMonths
    }
}

/**
 * Format atomic USDC units to human-readable string
 */
export function formatUsdc(atomicUnits: number): string {
    return (atomicUnits / 10 ** USDC_DECIMALS).toFixed(2)
}