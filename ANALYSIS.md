# OpenClaw SaaS - ClawHost 代碼分析與改造計劃

## Phase 1 完成項目
- ✅ Fork: https://github.com/airdrop-alpha/clawhost
- ✅ Clone: ~/clawd/projects/openclaw-saas/
- ✅ MIT 授權確認 — 允許商業使用和修改

---

## 1. 技術棧分析

| 層 | 技術 |
|----|------|
| **Monorepo** | pnpm workspaces + Turborepo |
| **前端 (apps/web)** | React + Vite + TailwindCSS + shadcn/ui |
| **後端 (apps/api)** | Hono framework on Next.js (port 2222) |
| **手機 (apps/mobile)** | React Native (Expo) |
| **DB** | PostgreSQL via Neon (serverless) + Drizzle ORM |
| **認證** | Firebase Auth (Magic Link / OTP) |
| **支付** | Polar.sh SDK (訂閱制) |
| **VPS** | Hetzner / DigitalOcean / Vultr (provider pattern) |
| **DNS** | Cloudflare API (subdomain 自動設置) |
| **郵件** | Resend |
| **i18n** | 自建 packages/i18n (目前只有英文) |
| **部署** | Vercel (vercel.json 存在) |

## 2. 架構亮點

### Provider Pattern (關鍵！)
`apps/api/src/services/provider/getProvider.ts` 使用策略模式：
- 所有 VPS provider 實現統一的 `CloudProvider` interface
- 新增 BitLaunch 只需實現同一 interface
- 已有 Hetzner, DigitalOcean, Vultr 三個實現可參考

### 資料庫 Schema
- `users` — 用戶（含 polarCustomerId）
- `claws` — 已部署實例（含 provider, subscriptionId 等）
- `pendingClaws` — 待支付實例（checkoutId 綁定）
- `sshKeys`, `volumes`, `rateLimits`, `otpCodes`, `clawExports`

### 部署流程
1. 用戶選方案 → `initiateClawPurchase` → Polar checkout
2. Polar webhook 回調 → `provisionClaw`
3. 調用 provider API 建 VPS → cloud-init 腳本自動安裝 OpenClaw
4. Cloudflare 設 DNS → 用戶通過 subdomain 訪問

---

## 3. 需要修改的部分

### A. 品牌改造 (低難度)
| 項目 | 原始 | 改為 |
|------|------|------|
| 名稱 | ClawHost | OpenClaw Deploy (或其他) |
| Logo | 螃蟹吉祥物 | 新設計 |
| 語言 | 英文 | 中英雙語 (i18n 已有框架) |
| 域名 | clawhost.com | TBD |

**涉及文件:** apps/web/src/components/Logo.tsx, Header.tsx, Footer.tsx, LandingFooter.tsx, packages/i18n/

### B. 支付系統 (中高難度) ⭐ 核心改造
| 項目 | 原始 | 改為 |
|------|------|------|
| 支付方式 | Polar.sh (信用卡訂閱) | x402 USDC on Base |
| SDK | @polar-sh/sdk | 自建 x402 payment module |
| Webhook | Polar webhook | 鏈上事件監聽 or x402 callback |
| 訂閱管理 | Polar 管理 | 智能合約 or 自建 |

**涉及文件 (全部替換):**
- `apps/api/src/lib/polar/` — 整個目錄 (7+ 文件)
- `apps/api/src/controllers/webhooks/polar.ts`
- `apps/api/src/controllers/claws/initiateClawPurchase.ts`
- `apps/api/src/controllers/users/getBillingHistory.ts`
- `apps/api/src/controllers/users/getCustomerPortal.ts`
- `apps/api/src/controllers/users/getOrderInvoice.ts`
- DB schema: 移除 `polar*` 欄位，新增 `x402*` 欄位
- `scripts/configure-polar-portal.ts`

### C. VPS Provider (中難度)
| 項目 | 原始 | 改為 |
|------|------|------|
| 主要 Provider | Hetzner | BitLaunch |
| API | REST (各家不同) | BitLaunch REST API |
| 優勢 | — | 支持 crypto 充值 |

**做法:** 新增 `apps/api/src/services/bitlaunch.ts`，實現 `CloudProvider` interface：
- `getServerTypes()` — 列出方案
- `createServer()` — 建立 VPS
- `deleteServer()` — 刪除
- `getServer()` / `getServerStatus()` — 查詢狀態
- `startServer()` / `stopServer()` / `restartServer()`
- SSH key 和 Volume 管理

### D. 預裝 Skills (低難度)
修改 `scripts/cloud-init.yaml` 和 `generateCloudInit()`:
- 預裝 crypto wallet skill
- 預裝 x402 payment skill
- 預裝 token scan skill
- 配置 OpenClaw gateway 預設設定

### E. 部署遷移 (低難度)
| 項目 | 原始 | 改為 |
|------|------|------|
| 前端 | Vercel | Cloudflare Pages |
| 後端 | Vercel Serverless | Cloudflare Workers (or keep Vercel) |
| DB | Neon PostgreSQL | 保留 Neon (CF Workers 支持) |

---

## 4. 改造優先級與計劃

### Phase 2: 支付 + Provider (2-3 天)
1. 建立 `services/bitlaunch.ts` — 實現 CloudProvider interface
2. 建立 `lib/x402/` — USDC 支付模組
3. 修改 DB schema — 移除 Polar，新增 x402 欄位
4. 修改部署流程 — x402 支付 → provision

### Phase 3: 品牌 + i18n (1 天)
1. 品牌替換
2. 新增中文翻譯
3. Landing page 改造

### Phase 4: 預裝 Skills (1 天)
1. 修改 cloud-init
2. 測試部署

### Phase 5: 部署上線 (1 天)
1. CF Pages 部署前端
2. 後端部署
3. 域名設置
4. E2E 測試

---

## 5. 風險評估

| 風險 | 等級 | 緩解 |
|------|------|------|
| BitLaunch API 文檔不全 | 🟡 | 先研究 API，必要時保留 Hetzner |
| x402 支付不穩定 | 🟡 | 先用簡單的 USDC transfer 確認 |
| Hono on CF Workers 兼容性 | 🟢 | Hono 原生支持 CF Workers |
| Firebase Auth on CF Workers | 🟡 | 可能需要改用其他 auth |

---

## 總結

ClawHost 代碼質量高，架構清晰，Provider Pattern 讓 VPS 替換很容易。最大工作量在**支付系統替換**（Polar → x402），其次是 BitLaunch 集成。預計 Phase 2-5 共需 5-7 天。
