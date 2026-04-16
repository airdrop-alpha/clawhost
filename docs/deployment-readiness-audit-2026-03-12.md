# OpenClaw SaaS 真實進度盤點與推進報告

日期：2026-03-12
範圍：`/Users/customer/clawd/projects/openclaw-saas`
方法：讀 repo 關鍵檔案、比對程式路徑、執行非破壞性驗證（`pnpm install`、API/Web typecheck）

---

## TL;DR

目前 repo **不是可直接部署的完成品**，而是：

- **核心 VPS provisioning 主幹已存在**：Hetzner / DigitalOcean / Vultr provider、建機、DNS、cloud-init 生成、Webhook 後 provision 流程都已經有主體。
- **BitLaunch 僅完成 backend provider 接口層，未接到真實銷售路徑**。
- **x402/USDC 支付僅完成局部底層模組，尚未接到 API / 前端 / provisioning 主流程**，原先若說「x402 已完成」屬於**假進度/未驗證進度**。
- **E2E 可部署性未閉環**：目前正式購買流程仍綁 Polar；x402 尚未取代；BitLaunch 未出現在 web 可購買路徑；也沒有 repo 內可重跑的完整 E2E 測試。

這次我已經先把最明顯的 deploy blocker 補掉：

1. 修正 x402 代碼與 DB schema 脫節：補上 `claws.paid_until` schema 與 migration。
2. 修正 drizzle migration journal 漏記 `0018_add_tier_column` 的問題，並補上 `0019_add_paid_until`。
3. 修正一個 web i18n key mismatch，讓 `api` + `web` typecheck 都能通過。
4. 補上本報告，讓目前真實狀態可被驗證。

---

## 本次實際驗證

### 已執行

```bash
pnpm install
pnpm --filter api typecheck
pnpm --filter web typecheck
```

### 結果

- `pnpm install`：成功
- `apps/api` typecheck：**成功**（修正後）
- `apps/web` typecheck：**成功**（修正後）

### 沒有執行的項目

以下未執行，因為需要外部憑證、雲資源或會造成真實副作用：

- 真實 Polar checkout / webhook 支付
- 真實 Base USDC 鏈上付款驗證
- 真實 BitLaunch 建機
- 真實 Cloudflare DNS 建立
- 真實 OpenClaw VPS 安裝與對外可訪問驗證

---

## 四條主線盤點

---

## 1) x402 支付

### 已完成

存在一組獨立的 x402/USDC 付款底層模組：

- `apps/api/src/lib/x402/createPayment.ts`
- `apps/api/src/lib/x402/verifyTransaction.ts`
- `apps/api/src/lib/x402/pricing.ts`
- `apps/api/src/lib/x402/scheduler.ts`
- `apps/api/src/lib/x402/constants.ts`
- `docs/x402-payment-design.md`

這表示：

- 已有 USDC Base 收款地址常量
- 已有 billing months 與折扣計算
- 已有 pending payment DB record 建立邏輯
- 已有 tx hash 驗證邏輯（讀 Base RPC receipt + USDC transfer log）
- 已有過期 payment / 過期 subscription 的 scheduler 概念

### 部分完成

- `payments` table 已經存在於 schema。
- `verifyTransaction()` 會在付款確認後更新 `claws.paidUntil` 與 `subscriptionStatus`。
- 但直到本次修正前，`claws.paidUntil` **根本不在 schema 裡**，導致這條鏈路無法通過型別檢查。

### 未驗證 / 假進度

以下都還**沒接上真實產品主流程**：

1. **沒有 payments routes / controllers**
   - repo 中沒有 `/payments/create`、`/payments/submit-tx`、`/payments/:id` 等 API 路由。
2. **沒有前端付款 UI**
   - web 仍是 checkout redirect 到 Polar。
3. **沒有用 x402 取代 Polar 的購買主流程**
   - `apps/api/src/controllers/claws/initiateClawPurchase.ts` 仍是 Polar customer + Polar checkout。
4. **沒有自動 provision 接點與 x402 完整串接**
   - `verifyTransaction()` 只會更新付款/訂閱狀態，不會直接把 pendingClaw 轉成實機 provision。
5. **沒有真實鏈上驗證測試**
   - 只有底層函式，沒有 repo 內可重跑的整合測試。

### 阻塞點

- 尚未定義 x402 付款完成後如何 claim `pending_claws` 並呼叫 `provisionClaw()`。
- schema 仍然保留大量 Polar 欄位，實際商業流程仍以 Polar 為中心。
- 缺少 payment API surface 與前端流程。
- 需要 Base RPC、收款地址資產管理、鏈上操作驗證策略。

### 結論

**狀態：部分完成，但離可上線還有明顯距離。**

更準確地說：
> x402 目前是「底層模組草稿 + 部分 DB 落地」，不是可部署的支付系統。

---

## 2) BitLaunch provision

### 已完成

Backend provider 已存在：

- `apps/api/src/services/bitlaunch.ts`
- `apps/api/src/services/provider/getProvider.ts`
- `apps/api/src/ts/Types.ts` 已包含 `bitlaunch`

已實作能力包括：

- 讀 BitLaunch create options
- 抓 Ubuntu image
- 建立 server
- 查 server / list servers
- restart / delete
- 取得 server types / locations / datacenter availability
- 建立與刪除 SSH key

`provisionClaw.ts` 也已經是 provider-agnostic，理論上可吃 `pending.provider = bitlaunch`。

### 部分完成

- 後端 provider 層可用，但**plan pricing / 銷售路徑沒打通**。
- `getPlans.ts`、`getPlanAvailability.ts` 雖有 `bitlaunch` 型別位，但 pricing config 是空的：
  - `bitlaunch: { order: [], prices: {} }`
  - `bitlaunch: {}`
- `initiateClawPurchase.ts` 的 `validProviders` 仍只有：
  - `hetzner`
  - `digitalocean`
  - `vultr`

### 未驗證 / 假進度

- web provider type 仍只有 `hetzner | digitalocean | vultr`，**前端根本沒有 BitLaunch 選項**。
- 沒有任何 repo 內證據顯示 BitLaunch 真正成功建過一台機。
- BitLaunch API header 寫法值得再次實測：
  - `Authorization: Bearer: ${token}`
  - 很可能應該是 `Bearer ${token}`；目前沒有驗證過。
- BitLaunch volume 明確不支援，與現有 product/UX 的 volume 選項存在能力差異。

### 阻塞點

- 沒有商品定價策略與 plan 映射。
- 前後端銷售流程未納入 BitLaunch。
- 真實 API token 未驗證。
- 需要決定 BitLaunch 是否作為第四個正式 provider，還是僅作實驗後端能力。

### 結論

**狀態：backend provider 已有，但產品化與可售賣性未完成。**

---

## 3) cloud-init / OpenClaw 自動安裝

### 已完成

關鍵邏輯存在於：

- `apps/api/src/controllers/claws/helpers/generateCloudInit.ts`
- `apps/api/src/controllers/claws/provisionClaw.ts`
- `scripts/cloud-init.yaml`（僅 reference）

已可見功能：

- 動態產生 cloud-init
- 根據 tier 產出不同 skills / template
- 生成 gateway token 與 subdomain
- 寫 OpenClaw config / env / systemd 等內容（由 generator 組裝）
- 建機後呼叫 Cloudflare 建 DNS

README 也明確把 cloud-init 描述為安裝主路徑。

### 部分完成

- `generateCloudInit()` 本身很完整，但仍屬**模板生成層**。
- repo 內沒有看到可重跑的 smoke test 去驗證輸出 cloud-init 是否始終包含關鍵段落（例如 gateway service、final_message、config path）。
- cloud-init 真正在不同 provider image 上是否 100% 成功，repo 內沒有證據。

### 未驗證 / 假進度

- 沒有真實 VPS 首次開機驗證紀錄。
- 沒有把 generated cloud-init 丟到 VM 的 CI/E2E。
- Cloudflare DNS 失敗會只 log error，不會 rollback 或進一步處理。
- OpenClaw 安裝成功後是否真的 reachable，缺少 end-to-end confirmation artifact。

### 阻塞點

- 需要真實 provider token、Cloudflare token、可對外網路環境。
- 需要一條自動化 smoke path 去驗證 provision 後可 SSH / 可 HTTP / gateway healthy。

### 結論

**狀態：安裝模板主幹完成，但仍欠真機驗證與自動化驗證。**

---

## 4) E2E 可部署性

### 已完成

- API / web monorepo 架構完整
- 基本 provisioning / account / plans / ssh keys / webhooks 路由齊全
- frontend 與 backend 能 typecheck 通過

### 部分完成

- README 把系統描述成接近完整 SaaS，但實際上付款主流程仍完全依賴 Polar。
- 後端存在多條未完成支線（x402、BitLaunch），但產品表面還沒切過去。

### 未驗證 / 假進度

- repo 內幾乎沒有可重跑的自動化 E2E 測試。
- 找不到針對「下單 → 付款 → webhook → provision → DNS → gateway 可訪問」的整合測試。
- `find . -name '*test*' -o -name '*spec*'` 幾乎沒有應用測試產物。

### 阻塞點

- 付款、DNS、雲主機、OpenClaw 安裝都依賴外部系統。
- 缺少 staging fixture / mock strategy / contract tests。
- 缺少 deploy readiness checklist。

### 結論

**狀態：不可宣稱 E2E ready。**

更準確的說法是：
> 目前 repo 是「可看出產品骨架與主流程方向」，但不是「已驗證可穩定部署的 SaaS」。

---

## 這次我做的實際修正

### 1. 修正 x402 schema 與實作脫節

檔案：
- `apps/api/src/db/schema.ts`
- `apps/api/drizzle/0019_add_paid_until.sql`

內容：
- 為 `claws` 補上 `paidUntil: timestamp('paid_until')`
- 讓 `verifyTransaction.ts` / `scheduler.ts` 不再引用不存在欄位

影響：
- x402 相關 API 模組至少回到「型別一致、可繼續開發」狀態

### 2. 修正 migration journal 不完整

檔案：
- `apps/api/drizzle/meta/_journal.json`

內容：
- 補上遺漏的 `0018_add_tier_column`
- 加入 `0019_add_paid_until`

影響：
- 避免 migration 檔存在但 journal 不跟的狀況，讓 DB 演進紀錄更接近真實

### 3. 修正 web i18n key mismatch

檔案：
- `apps/web/src/pages/Landing.tsx`
- `packages/i18n/src/langs/zh.ts`

內容：
- 把 `landing.whyClawHost` 改回實際存在的 key 路徑
- 同步中英 key 名稱

影響：
- web typecheck 恢復通過

### 4. 補上真實盤點報告

檔案：
- `docs/deployment-readiness-audit-2026-03-12.md`

影響：
- 之後討論可以直接對照這份，不用再靠印象判斷進度

---

## 修正前後對比

### 修正前

- `apps/api` typecheck 失敗（`paidUntil` 不存在）
- `apps/web` typecheck 失敗（i18n key mismatch）
- migration journal 與 SQL 檔不一致

### 修正後

- `apps/api` typecheck：✅
- `apps/web` typecheck：✅
- x402 schema 與代碼一致性：✅ 至少回到可開發狀態

---

## 目前最短路徑建議（下一步優先順序）

### Priority 1 — 把「付款 → provision」選一條主線做實

二選一，不要同時推：

#### 路線 A：先把 Polar 做到真的穩可部署
適合最短交付。

要做：
1. 補 staging checklist
2. 補 webhook contract test / mock test
3. 補 provision smoke test 文檔與人工驗證步驟
4. 確認 Cloudflare + provider tokens + env sample 完整

#### 路線 B：真的切去 x402
適合產品方向切換，但工作量明顯更大。

最少要補：
1. payments routes/controllers
2. 前端付款頁/狀態頁
3. x402 付款成功後 claim `pending_claws`
4. 呼叫 `provisionClaw()`
5. 到期/續費路由
6. 真實 Base tx 驗證 smoke test

### Priority 2 — 決定 BitLaunch 的定位

如果要正式上線：
- 加入 plan pricing 與銷售入口
- 前端 provider selector 納入 BitLaunch
- 驗證 Authorization header 與真實 createServer

如果只是實驗：
- README / docs 明講「backend-only experimental provider」

### Priority 3 — 補 deployability 證據

至少要有：
- 一份 staging deploy checklist
- 一份 provider/env matrix
- 一套 smoke verification steps
- 最好再加最小整合測試（mock 外部 provider）

---

## 我對目前 repo 的真實判斷

### 已完成

- 多 provider 抽象層骨架
- Polar 購買 + webhook + provision 主線骨架
- cloud-init 生成主體
- OpenClaw auto-install 思路與實作主路徑
- API / web 基本代碼品質回到可 typecheck

### 部分完成

- x402 支付
- BitLaunch provider
- tier / custom skills 安裝邏輯
- 刪機 / 過期訂閱處理

### 未驗證 / 假進度

- x402 已上線
- BitLaunch 已可賣
- E2E 可部署
- cloud-init 已跨 provider 穩定驗證

### 主要阻塞

- 外部憑證與真實雲資源驗證缺失
- 缺少 E2E / smoke / contract tests
- 產品主流程尚未決定是 Polar 還是 x402
- BitLaunch 尚未接到真實售賣面

---

## 給 Ted 的精簡中文報告

我把 openclaw-saas 做了一次真實盤點，也順手修了最明顯的 deploy blocker。

結論很直接：

1. **目前不是可直接宣稱可部署的完成品**。
2. **Polar 主流程骨架有了**，但還缺可重跑的 E2E 證據。
3. **x402 只是底層模組做到一半**，還沒接到 API、前端與 provision 主流程；之前如果說 x402 已完成，這個判斷偏樂觀。
4. **BitLaunch 只有 backend provider 層，還沒接進產品購買路徑**。
5. **cloud-init / OpenClaw 自動安裝主幹是有的**，但沒有真機驗證閉環。

我這次已經做的事：
- 補上 `claws.paid_until` schema + migration，修掉 x402 代碼與 DB 脫節
- 修正 drizzle migration journal 漏項
- 修正 web 一個 i18n 型別錯誤
- 讓 `api` 和 `web` typecheck 都通過
- 把完整盤點寫進 `docs/deployment-readiness-audit-2026-03-12.md`

如果你要我選最短路徑，我建議：
**先不要同時推 Polar 與 x402。先選一條付款主線做實。**
若目標是最快接近可交付，應先把 **Polar → webhook → provision → gateway 可訪問** 這條鏈補齊驗證；若目標是改商業模式，再集中把 x402 真正接完。
