# Polar 主線驗證清單（本地最接近 E2E）

更新時間：2026-03-12

目標閉環：`Polar checkout -> webhook -> provision -> gateway reachable`

這份文件只聚焦目前 repo 內已經能做到、且可重跑的驗證方式。

## 1. 目前已補強到哪裡

### 已完成
- `provisionClaw.integration.test.ts` 近似整合驗證會：
  - mock provider `createServer` / `createVolume`
  - mock Cloudflare `createDNSRecord`
  - 驗證 `pending_claws -> claws -> volumes` 的核心 DB side effects
  - 驗證 provider 建機失敗時會 rollback 已插入的 claw row
- `polar.contract.test.ts` 會直接打 webhook handler 入口，覆蓋：
  - 固定 payload + 固定簽章的 `checkout.updated`
  - 固定 payload + 固定簽章的 `subscription.active` idempotency（既有 claw 時不重複 provision）
  - 真實 `parseWebhook()` / signature verify
  - `handlePolarWebhook()` 入口
  - 透過 fake DB / mock provider / mock DNS 驗證 `provisionClaw()` 核心 side effects
  - invalid signature 會被擋下，且不會進入 provision
- `/api/claws/purchase` 會：
  - 重新用 provider plan 資料校驗 `planId / location / memory / priceMonthly`
  - 建立更完整的 Polar metadata（`pendingClawId / provider / planId / location / name / sshKeyId / volumeSize / model / priceMonthly`）
  - 寫入 `pending_claws`
- `/api/webhooks/polar` 會：
  - 驗證 Polar webhook signature
  - 在 `checkout.updated(status=succeeded)` **或** `subscription.active` 都嘗試觸發 provision
  - 保持 idempotent：同一個 `polarSubscriptionId` 不會重複建機
- `provisionClaw()` 會：
  - claim `pending_claws`
  - 建立 claw 記錄
  - 生成 cloud-init（含 gateway token、nginx、SSL、firewall）
  - 呼叫 provider 建機
  - 建立 Cloudflare DNS record
- 已新增可重跑驗證資產：
  - 單元測試：webhook signature / cloud-init smoke
  - 本地 mock webhook script：`scripts/mock-polar-webhook.ts`

### 尚未完成
- 沒有真實 Polar sandbox/production 憑證時，無法跑真正信用卡付款
- 沒有真實雲供應商 / Cloudflare 憑證時，無法真的建機與驗證外網 gateway reachability
- repo 內仍缺「完整整合測試」去 mock DB + provider + DNS 一次走完整條路

---

## 2. 本地可跑的最低驗證

### 2.1 測試
```bash
pnpm --filter api test
pnpm --filter api typecheck
```

目前覆蓋：
- `verifyWebhookSignature` 簽章驗證
- `generateCloudInit` 關鍵輸出 smoke（gateway / nginx / certbot / final_message）
- `provisionClaw.integration`：pending claim、claw insert/update、provider createServer、Cloudflare DNS、volume create、provider failure rollback
- `polar.contract`：固定簽章 webhook request -> `parseWebhook()` -> handler 入口 -> `provisionClaw()` -> provider / DNS / DB side effects

### 2.2 啟動 API
```bash
pnpm dev:api
```

預設 API：`http://localhost:2222`

---

## 3. 本地 replay webhook（不需真的去 Polar 點付款）

### 3.1 先準備環境變數
在 `apps/api/.env` 至少要有：

```bash
POLAR_WEBHOOK_SECRET=polar_whs_xxx
DATABASE_URL=...
ENCRYPTION_KEY=...
```

若要真的 provision，還需要對應 provider / Cloudflare 憑證。

### 3.2 先製造一筆 pending_claw
有兩種方式：

#### 方式 A：走真實 purchase API
前提：你已有 `POLAR_ACCESS_TOKEN`、product env vars、可登入使用者 Bearer token。

#### 方式 B：直接插入一筆測試資料到 `pending_claws`
最少需要：
- `id`
- `user_id`
- `checkout_id`
- `name`
- `provider`
- `plan_id`
- `location`
- `price_monthly`
- `expires_at`

---

## 4. Replay webhook

### 模擬 `checkout.updated`
```bash
POLAR_WEBHOOK_SECRET='polar_whs_xxx' \
PENDING_CLAW_ID='your-pending-id' \
CHECKOUT_ID='chk_test_123' \
SUBSCRIPTION_ID='sub_test_123' \
CUSTOMER_ID='cus_test_123' \
PRODUCT_ID='prod_test_123' \
pnpm --filter api exec tsx ../../scripts/mock-polar-webhook.ts checkout.updated
```

### 模擬 `subscription.active`
```bash
POLAR_WEBHOOK_SECRET='polar_whs_xxx' \
PENDING_CLAW_ID='your-pending-id' \
SUBSCRIPTION_ID='sub_test_123' \
CUSTOMER_ID='cus_test_123' \
PRODUCT_ID='prod_test_123' \
pnpm --filter api exec tsx ../../scripts/mock-polar-webhook.ts subscription.active
```

成功時，script 會印出：
- target URL
- event type
- response status
- response body
- 實際送出的簽章 header
- payload

---

## 5. 最接近閉環的人工驗證路徑

### A. Purchase 段
- [ ] `POST /api/claws/purchase` 成功返回 `checkoutUrl / checkoutId / pendingClawId / expiresAt`
- [ ] DB `pending_claws` 可看到新資料
- [ ] `price_monthly` 來自 provider 計算，不是前端隨意傳值

### B. Webhook 段
- [ ] mock script 可成功打到 `/api/webhooks/polar`
- [x] contract test 會驗證固定簽章 request 可通過 `/webhooks/polar` handler 並回 `200` + `{ received: true }`
- [x] contract test 會驗證 invalid signature 被拒絕且不會進入 provision
- [x] 若 `checkout.updated` 已帶 `subscriptionId`，handler 會直接嘗試 provision（contract test）
- [x] 若稍後又收到 `subscription.active`，且既有 claw 已綁定同一 `polarSubscriptionId`，不會重複建機（contract test）

### C. Provision 段
- [x] `pending_claws` 被 claim / 刪除（integration test）
- [x] `claws` 新增一筆資料（integration test）
- [x] `claws.polar_subscription_id` / `polar_product_id` / `polar_customer_id` 已寫入（integration test）
- [x] `claws.gateway_token` 已產生（DB 內為加密值，integration test 用 stub encryption 驗證資料流）
- [x] `status` 至少進入 `creating` / `configuring`（integration test）
- [x] provider `createServer` / `createVolume` 參數有被驗證（integration test）
- [x] DNS side effect 有被驗證（integration test）
- [x] provider 建機失敗時 claw row 會 rollback（integration test）

### D. Gateway reachable 段（需真實 provider + Cloudflare）
- [ ] provider 已建立主機
- [ ] DNS subdomain 已建立
- [ ] 主機內 `openclaw-gateway.service` 存在並啟動
- [ ] 主機內 `curl http://127.0.0.1:18789` 有回應
- [ ] 外網 `https://<subdomain>.<domain>/` 可打通

---

## 6. 目前阻塞點

如果要從「本地最接近 E2E」走到「真 E2E」，還缺：

1. **Polar 真實測試憑證**
   - `POLAR_ACCESS_TOKEN`
   - `POLAR_ORGANIZATION_ID`
   - `POLAR_WEBHOOK_SECRET`
   - 對應 `POLAR_PRODUCT_*`
2. **雲供應商憑證**
   - Hetzner / DigitalOcean / Vultr 至少一條可用
3. **Cloudflare 憑證**
   - zone id + api token
4. **`subscription.active` idempotency contract coverage 已補上**
   - 已覆蓋 existing claw + `subscription.active` 的 handler-level contract test
   - 已驗證不會再次走 provision，也不會觸發 provider / DNS side effects

---

## 7. 邊界與建議下一步（最短路徑）

目前 repo 已補到兩層：
- `provisionClaw.integration.test.ts`：覆蓋 `claim pending -> 建 claw -> provider side effect -> DNS side effect -> claw update -> volume insert`
- `polar.contract.test.ts`：覆蓋固定 payload + 固定簽章 -> `parseWebhook()` -> `handlePolarWebhook()` -> `provisionClaw()` -> side effects，以及 existing claw + `subscription.active` 的 idempotency

仍未覆蓋：
- 真實 Neon / Polar / Cloudflare / provider 憑證下的完整外部閉環
- gateway 對外 reachable smoke

下一步建議：

1. 拿一組 Polar sandbox + Hetzner 測試憑證，實跑一次真建機。
2. 在真實 provider 環境補 webhook replay smoke，確認重送 `subscription.active` 仍不會重複建機。
3. 在 README 補上這份 checklist 與 mock webhook replay 指令，讓別人可照表驗證。
