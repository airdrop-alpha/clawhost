export const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const PAY_TO_ADDRESS = '0x22972D8d1E46387030B4A95BDf2450f2b8577973'
export const BASE_CHAIN_ID = 8453
export const USDC_DECIMALS = 6

// ERC20 Transfer event signature
export const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// Payment expiry
export const PAYMENT_EXPIRY_HOURS = 24
export const GRACE_PERIOD_DAYS = 3
export const DELETION_DELAY_DAYS = 7

// Billing discounts
export const BILLING_DISCOUNTS: Record<number, number> = {
    1: 0,      // monthly: no discount
    3: 0.05,   // quarterly: 5% off
    6: 0.10,   // semi-annual: 10% off
    12: 0.15   // annual: 15% off
}

// Amount tolerance for matching (in atomic units, = $0.01)
export const AMOUNT_TOLERANCE = 10000