import { pgTable, text, timestamp, integer, bigint } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
    polarCustomerId: text('polar_customer_id'),
    role: text('role').notNull().default('user'),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const claws = pgTable('claws', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id),
    name: text('name').notNull(),
    provider: text('provider').notNull().default('hetzner'),
    providerServerId: text('provider_server_id'),
    status: text('status').notNull().default('creating'),
    ip: text('ip'),
    planId: text('plan_id').notNull(),
    location: text('location'),
    rootPassword: text('root_password'),
    sshKeyId: text('ssh_key_id').references(() => sshKeys.id),
    subdomain: text('subdomain'),
    gatewayToken: text('gateway_token'),
    model: text('model'),
    tier: text('tier').notNull().default('basic'),
    polarSubscriptionId: text('polar_subscription_id'),
    polarProductId: text('polar_product_id'),
    polarCustomerId: text('polar_customer_id'),
    paidUntil: timestamp('paid_until'),
    subscriptionStatus: text('subscription_status').default('pending'),
    deletionScheduledAt: timestamp('deletion_scheduled_at'),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const pendingClaws = pgTable('pending_claws', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id),
    checkoutId: text('checkout_id').notNull().unique(),
    name: text('name').notNull(),
    provider: text('provider').notNull().default('hetzner'),
    planId: text('plan_id').notNull(),
    location: text('location').notNull(),
    rootPassword: text('root_password'),
    sshKeyId: text('ssh_key_id').references(() => sshKeys.id),
    volumeSize: integer('volume_size'),
    model: text('model'),
    tier: text('tier').notNull().default('basic'),
    apiToken: text('api_token'),
    priceMonthly: integer('price_monthly').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull()
})

export const sshKeys = pgTable('ssh_keys', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id),
    name: text('name').notNull(),
    publicKey: text('public_key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    providerKeyId: integer('provider_key_id'),
    digitaloceanKeyId: integer('digitalocean_key_id'),
    vultrKeyId: integer('vultr_key_id'),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const rateLimits = pgTable('rate_limits', {
    key: text('key').primaryKey(),
    lastSentAt: timestamp('last_sent_at').notNull()
})

export const otpCodes = pgTable('otp_codes', {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const clawExports = pgTable('claw_exports', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id),
    clawId: text('claw_id')
        .notNull()
        .references(() => claws.id),
    fileSize: integer('file_size'),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const payments = pgTable('payments', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id),
    clawId: text('claw_id').references(() => claws.id),
    amountUsdc: integer('amount_usdc'),
    expectedAmount: integer('expected_amount').notNull(),
    billingMonths: integer('billing_months').notNull().default(1),
    reference: text('reference').notNull(),
    status: text('status').notNull().default('pending'),
    txHash: text('tx_hash').unique(),
    fromAddress: text('from_address'),
    confirmedAt: timestamp('confirmed_at'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const volumes = pgTable('volumes', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id),
    clawId: text('claw_id').references(() => claws.id),
    name: text('name').notNull(),
    size: integer('size').notNull(),
    providerVolumeId: integer('provider_volume_id'),
    location: text('location').notNull(),
    status: text('status').notNull().default('creating'),
    createdAt: timestamp('created_at').defaultNow().notNull()
})