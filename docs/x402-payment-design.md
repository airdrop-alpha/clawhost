# x402 USDC Payment Module Design

## Date: 2026-02-13
## Status: Draft

---

## 1. 現有 Polar.sh 支付流程分析

### 購買流程
1. 用戶選方案 → `POST /claws/purchase` → `initiateClawPurchase.ts`
2. 建立 Polar customer（如果沒有）→ 存 `polarCustomerId` 到 users 表
3. 建立 Polar checkout session → 取得 `checkoutUrl`
4. 寫 `pendingClaws` 記錄（含 `checkoutId`，24h 過期）
5. 前端跳轉 Polar checkout URL → 用戶付款
6. Polar webhook 回調 → `checkout.updated` / `subscription.created`
7. Webhook handler 取 `pendingClawId` from metadata → 呼叫 `provisionClaw()`
8. 建立伺服器、寫 `claws` 記錄（含 `polarSubscriptionId`）

### 訂閱管理
- 月付自動續費（Polar 處理）
- 取消 = 設 `cancelAtPeriodEnd: true`
- 到期 → webhook `subscription.revoked` → 排程刪機

### DB 欄位（需替換）
- `users.polarCustomerId`
- `claws.polarSubscriptionId`, `polarProductId`, `polarCustomerId`
- `pendingClaws.checkoutId`（綁 Polar checkout）

---

## 2. x402 USDC 替代方案設計

### 2.1 付款方式：直接 USDC 轉帳 + 鏈上驗證

**不用 x402 protocol 的原因：** x402 是 per-request 微支付協議（HTTP 402），適合 API 調用計費。SaaS 月費訂閱用直接轉帳更直覺。

**方案：**
- 用戶點購買 → 後端生成付款指示（收款地址 + 金額 + unique memo/reference）
- 前端顯示付款資訊（地址 + 金額 + QR code）
- 支援：手動轉帳 / WalletConnect / Coinbase Wallet deep link
- 後端監聽 Base 鏈上 USDC Transfer 事件確認到帳

### 2.2 付款確認：鏈上事件監聯

**Primary:** 用 Base RPC 輪詢/WebSocket 監聽 USDC Transfer to 收款地址
- 匹配金額 + 時間窗口（±$0.01 容差，24h 內）
- 可用 Alchemy/Infura/public RPC 的 `eth_getLogs`

**Fallback (MVP):** Admin 手動確認
- 用戶提交 tx hash → 後端驗證 on-chain → 自動或手動批准

### 2.3 定價模式：預付制（非自動續費）

**原因：** 鏈上沒有自動扣款機制（不像信用卡），預付最簡單。

| 方案 | 折扣 | USDC |
|------|------|------|
| 月付 | 0% | 按方案定價 |
| 季付 (3月) | 5% | × 0.95 |
| 半年 (6月) | 10% | × 0.90 |
| 年付 (12月) | 15% | × 0.85 |

### 2.4 續費 & 到期

- 到期前 7天、3天、1天發 email/通知提醒
- 用戶手動續費（生成新付款）
- 到期後 3 天寬限期 → 暫停服務 → 再 7 天 → 刪除
- 續費 = 新的 payment record，延長 `paidUntil`

---

## 3. DB Schema 變更

### 移除 Polar 欄位
```sql
-- users: 移除 polarCustomerId，新增 walletAddress
ALTER TABLE users DROP COLUMN polar_customer_id;
ALTER TABLE users ADD COLUMN wallet_address TEXT;

-- claws: 替換 polar 欄位
ALTER TABLE claws DROP COLUMN polar_subscription_id;
ALTER TABLE claws DROP COLUMN polar_product_id;
ALTER TABLE claws DROP COLUMN polar_customer_id;
ALTER TABLE claws ADD COLUMN paid_until TIMESTAMP;
ALTER TABLE claws ADD COLUMN plan_price_usdc INTEGER; -- atomic units (6 dec)
ALTER TABLE claws ADD COLUMN billing_cycle TEXT DEFAULT 'monthly';
```

### 新增 payments 表
```sql
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    claw_id TEXT REFERENCES claws(id),
    amount_usdc INTEGER NOT NULL,        -- atomic units (6 decimals)
    billing_months INTEGER NOT NULL,     -- 1, 3, 6, or 12
    status TEXT NOT NULL DEFAULT 'pending', -- pending | confirming | confirmed | expired | failed
    tx_hash TEXT,
    from_address TEXT,
    expected_amount INTEGER NOT NULL,    -- what we expect to receive
    reference TEXT NOT NULL UNIQUE,      -- unique payment reference
    expires_at TIMESTAMP NOT NULL,
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Drizzle Schema
```typescript
export const payments = pgTable('payments', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    clawId: text('claw_id').references(() => claws.id),
    amountUsdc: integer('amount_usdc').notNull(),
    billingMonths: integer('billing_months').notNull(),
    status: text('status').notNull().default('pending'),
    txHash: text('tx_hash'),
    fromAddress: text('from_address'),
    expectedAmount: integer('expected_amount').notNull(),
    reference: text('reference').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    confirmedAt: timestamp('confirmed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull()
})
```

---

## 4. MVP 最快路線

### Phase 1: 手動確認（1-2 天）
1. 用戶選方案 → 顯示收款地址 + 金額
2. 用戶轉帳 → 提交 tx hash
3. 後端用 RPC 驗證 tx（金額、收款地址、USDC 合約）
4. 自動確認 → provision claw
5. `paidUntil` 設為 N 個月後

### Phase 2: 自動監聽（之後）
- 背景 worker 每 30s 輪詢 USDC Transfer logs
- 自動匹配 pending payments
- 自動確認 + provision

### Phase 3: 前端整合
- WalletConnect / Coinbase Wallet 整合
- 一鍵付款按鈕
- 即時確認

---

## 5. 關鍵常量

```typescript
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const PAY_TO = '0x22972D8d1E46387030B4A95BDf2450f2b8577973'
const BASE_CHAIN_ID = 8453
const USDC_DECIMALS = 6
```

---

## 6. API 端點設計

```
POST /api/payments/create     - 建立付款（選方案+月數）
POST /api/payments/submit-tx  - 提交 tx hash
GET  /api/payments/:id        - 查詢付款狀態
GET  /api/payments/history    - 付款歷史
POST /api/payments/renew      - 續費
```
