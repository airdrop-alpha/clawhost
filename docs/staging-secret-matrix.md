# Staging Secret Matrix

更新時間：2026-03-12

目標：為後續 **Step 5B 真實外部驗證** 準備一份不含任何真實 secret 的配置矩陣，讓執行者可以照表向對的人索取、填入、驗證、清理。

相關文件：
- 本地近似 E2E checklist：[`docs/polar-e2e-checklist.md`](./polar-e2e-checklist.md)
- 真實憑證 staging runbook：[`docs/staging-real-credential-runbook.md`](./staging-real-credential-runbook.md)
- API staging template：[`apps/api/.env.staging.example`](../apps/api/.env.staging.example)
- Web staging template：[`apps/web/.env.staging.example`](../apps/web/.env.staging.example)

---

## 1. 使用方式

### 填表原則
- **不要把真實 secret commit 進 repo**。
- `.env.staging.example` 只放 placeholder、格式說明、註解。
- 真實值應放在：
  - CI/CD secret manager
  - 受控的 1Password / Vault / Doppler / Railway / Vercel / Cloudflare secret store
  - 或部署主機上的未追蹤 env 檔
- 若某欄可先用 mock 替代，先標記並走 A 階段驗證；只有進入 B 才補真實值。

### 敏感度分級
- **Critical**：可直接造成帳號/基礎設施/API 資產失陷
- **High**：可影響對外資源、付費、DNS、雲資源或管理權限
- **Medium**：前端公開設定或低風險控制面資訊
- **Low**：非 secret，但為環境正確性所必需

### 驗證步驟欄位怎麼看
- 這裡的「對應驗證步驟」對應的是後續 staging runbook / checklist 會用到的動作。
- 若一個變數沒有對應外部驗證步驟，代表它主要用來支撐系統啟動，不是外部閉環主線的 gating item。

---

## 2. API / 後端 staging matrix

| 變數名 | 用途 | 來源 / 由誰提供 | Staging 必填 | 可用 mock 替代 | 風險等級 | 對應驗證步驟 / 檢查點 |
|---|---|---|---|---|---|---|
| `PORT` | API 監聽埠，預設 `2222` | 工程 / 部署方 | 是 | 否 | Low | Step 1：API 成功啟動 |
| `NODE_ENV` | 影響 CORS 與執行模式 | 工程 / 部署方 | 是 | 否 | Low | Step 1：API 啟動；**注意目前 production CORS allowlist 寫死** |
| `DATABASE_URL` | API 主資料庫（users / pending_claws / claws / sshKeys / volumes） | DB / DevOps | 是 | A 階段可用本地或測試 DB | Critical | Step 0 / 1 / 3 / 6：migration、pending / claws 狀態檢查 |
| `ENCRYPTION_KEY` | 加密 `rootPassword` / `gatewayToken` 等敏感欄位；需 64 hex chars | 工程 / DevOps 產生並保管 | 是 | 否 | Critical | Step 1 / 6：purchase、provision 後資料可穩定加解密 |
| `CLIENT` | Polar checkout success / customer portal return URL 基礎值 | 工程 / 部署方 | 是 | 否 | Medium | Step 3 / billing portal；**目前程式預期 host-only，不要含 scheme** |
| `FIREBASE_PROJECT_ID` | Firebase Admin 驗證設定 | Firebase 管理者 | 是 | A 階段可用獨立 staging project | High | Step 1：登入 / bearer token / auth middleware |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin service account email | Firebase 管理者 | 是 | 否 | High | Step 1：登入與 token 驗證 |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin private key | Firebase 管理者 | 是 | 否 | Critical | Step 1：登入與 token 驗證 |
| `POLAR_ACCESS_TOKEN` | 建立 checkout / customer portal / product 管理 | Polar 管理者 | 是（B） | A 階段可不填，用 mock checklist | Critical | Step 3 / 4：建立真實 checkout |
| `POLAR_ORGANIZATION_ID` | Polar organization 綁定 | Polar 管理者 | 是（B） | A 階段可不填 | Medium | Step 3 / portal / product config |
| `POLAR_WEBHOOK_SECRET` | 驗證 `/api/webhooks/polar` 簽章 | Polar 管理者 | 是（B） | A 階段可用 mock secret | Critical | Step 5：webhook 200 + 簽章驗證通過 |
| `POLAR_PRODUCT_<PLAN>` | `provider + planId` 對應到 Polar product ID，例如 `POLAR_PRODUCT_CX22`、`POLAR_PRODUCT_DIGITALOCEAN_S_2VCPU_4GB` | Polar 管理者 / 工程共同整理 | 是（B，至少本輪測試 plan 要有） | A 階段可不填 | Medium | Step 2 / 3：`paymentNotConfigured` 不可出現 |
| `HETZNER_API_TOKEN` | Hetzner 建機 / 查 plan / location / volume | 雲資源管理者 | 若本輪測 Hetzner 則是 | 可改用其他 provider，不可 mock 真外部閉環 | Critical | Step 2 / 6 / 7：plan/location 查詢、createServer |
| `DIGITALOCEAN_API_TOKEN` | DigitalOcean provider token | 雲資源管理者 | 若本輪測 DO 則是 | 可改測其他 provider | Critical | Step 2 / 6 / 7 |
| `VULTR_API_TOKEN` | Vultr provider token | 雲資源管理者 | 若本輪測 Vultr 則是 | 可改測其他 provider | Critical | Step 2 / 6 / 7 |
| `BITLAUNCH_API_TOKEN` | BitLaunch provider token（若走 bitlaunch） | 雲資源管理者 | 若本輪測 BitLaunch 則是 | 可改測其他 provider | Critical | Step 2 / 6 / 7 |
| `CLOUDFLARE_API_TOKEN` | 建立 / 刪除 staging DNS record | DNS / DevOps | 是（B） | A 階段可不填 | Critical | Step 6 / 8：A record 建立與清理 |
| `CLOUDFLARE_ZONE_ID` | 指向 staging zone | DNS / DevOps | 是（B） | A 階段可不填 | High | Step 8：DNS 建立到正確 zone |
| `RESEND_API_KEY` | magic link / OTP 郵件發送 | Email / DevOps | 視登入方式 | 可暫時改用已有 token 或人工 DB 帳號，不建議長期 mock | High | Step 1：登入郵件是否可送達 |
| `FROM_EMAIL` | magic link / OTP 寄件者 | Email / 工程 | 視是否走郵件登入 | 可用 placeholder domain in A | Medium | Step 1：magic link 郵件顯示正確 |
| `ADMIN_USER_IDS` | 管理員白名單 UID | 工程 / 運維 | 否 | 可不填 | Medium | 非主線；需要 admin 路由時再驗 |
| `BASE_RPC_URL` | x402 / onchain 驗證 RPC；與本次 Polar 主線無直接耦合 | 工程 / Web3 infra | 否 | 可用預設 `https://mainnet.base.org` | Medium | 非本次主線 |

---

## 3. Web / 前端 staging matrix

| 變數名 | 用途 | 來源 / 由誰提供 | Staging 必填 | 可用 mock 替代 | 風險等級 | 對應驗證步驟 / 檢查點 |
|---|---|---|---|---|---|---|
| `VITE_API_URL` | Web 呼叫 API 的 base URL；staging 應指向 staging API `/api` | 工程 / 部署方 | 是 | A 階段可指向本地 API | Low | Step 1 / 2 / 3：plans、locations、purchase 可正常打到 API |
| `VITE_FIREBASE_API_KEY` | Firebase Web config | Firebase 管理者 | 是 | 否 | Medium | Step 1：Web 登入初始化 |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Web auth domain | Firebase 管理者 | 是 | 否 | Medium | Step 1：magic link / authorized domains |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Web project id | Firebase 管理者 | 是 | 否 | Medium | Step 1：Web 登入初始化 |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Web config | Firebase 管理者 | 建議填 | 可暫空，但最好一致 | Low | Step 1：Firebase config 一致性 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web config | Firebase 管理者 | 建議填 | 不建議 mock | Low | Step 1：Firebase config 一致性 |
| `VITE_FIREBASE_APP_ID` | Firebase Web app id | Firebase 管理者 | 是 | 否 | Medium | Step 1：Web 登入初始化 |

> 備註：`VITE_*` 屬於前端可見設定，不應視為真正 secret，但仍要確保它們指向 **staging 專案** 而非 production。

---

## 4. 推薦的 provider / plan 命名與 product mapping 檢查法

`/api/claws/purchase` 會根據下列規則尋找 product env：

- Hetzner：`POLAR_PRODUCT_${PLAN_ID_UPPERCASE_WITH_UNDERSCORES}`
- 其他 provider：`POLAR_PRODUCT_${PROVIDER}_${PLAN_ID_UPPERCASE_WITH_UNDERSCORES}`

範例：

| provider | planId | 期望 env key |
|---|---|---|
| `hetzner` | `cx22` | `POLAR_PRODUCT_CX22` |
| `hetzner` | `cpx31` | `POLAR_PRODUCT_CPX31` |
| `digitalocean` | `s-2vcpu-4gb` | `POLAR_PRODUCT_DIGITALOCEAN_S_2VCPU_4GB` |
| `vultr` | `vc2-2c-4gb` | `POLAR_PRODUCT_VULTR_VC2_2C_4GB` |

建議：
- B 階段第一輪只配 **一個 provider + 一個 plan + 一個 region**。
- 先確認該 plan 記憶體 `>= 4GB`，否則 purchase 會被後端拒絕。

---

## 5. B 階段前的 blocking / 注意事項

這些不是 secret 本身，但會直接影響 B 能不能一次跑通：

### 5.1 `CLIENT` 格式目前有程式歧義
目前 `getPolarConfig()` 與 `getCustomerPortal()` 會自行補 `http://` 或 `https://`：

```ts
const http = clientUrl?.includes('localhost') ? 'http' : 'https'
const successUrl = `${http}://${url}/claws?...`
```

所以 **目前 `CLIENT` 應填 host-only**，例如：

```bash
CLIENT=staging-web.example.com
```

不要填：

```bash
CLIENT=https://staging-web.example.com
```

否則會組出錯誤 URL。

### 5.2 `NODE_ENV=production` 目前會啟用硬編碼 CORS allowlist
`apps/api/src/app.ts` 目前 production 模式只允許：
- `https://clawhost.cloud`
- `https://www.clawhost.cloud`

如果 staging API / web 用其他 domain，則 **B 階段在真實 staging domain 上可能被 CORS 擋住**。

建議在進 B 前先做其中一種：
- 擴充 CORS allowlist 支援 staging domain
- 或改成 env-driven allowlist
- 或在驗證時先用非 production `NODE_ENV`（只適合短期內部驗證，不是長久解）

### 5.3 Cloudflare domain 假設目前仍偏向固定主域
程式碼中有 `findDNSRecord()` 將查詢名寫成 `${subdomain}.clawhost.cloud`。若 B 階段要用獨立 staging zone，需確認所有 domain 假設都一致。

---

## 6. 建議交付 / 索取責任分工

| 項目 | 建議 owner |
|---|---|
| Staging DB 建立與 `DATABASE_URL` | DevOps / backend owner |
| `ENCRYPTION_KEY` 產生與保管 | DevOps / security owner |
| Firebase staging project + service account | Auth / Firebase owner |
| Polar org / product / webhook secret | Billing / Polar owner |
| Provider token（Hetzner/DO/Vultr/BitLaunch） | Infra owner |
| Cloudflare staging zone + token | DNS / platform owner |
| Resend staging sender | Email / platform owner |
| Web / API staging deployment target | DevOps / frontend + backend owner |

---

## 7. 最小可執行 secret 收集順序

若目標是最快進入 B，建議照這個順序收齊：

1. `DATABASE_URL`
2. `ENCRYPTION_KEY`
3. Firebase 三件組（`FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`）
4. Web Firebase 六件組（`VITE_FIREBASE_*`）
5. `CLIENT` + `VITE_API_URL`
6. `POLAR_ACCESS_TOKEN` / `POLAR_ORGANIZATION_ID` / `POLAR_WEBHOOK_SECRET`
7. 至少一個 `POLAR_PRODUCT_*`
8. 單一 provider token
9. `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID`
10. 視登入方式補 `RESEND_API_KEY` + `FROM_EMAIL`

做到第 1–5 步，可以先完成「staging 啟動 + 登入 + plans/location/purchase 前校驗」。
做到第 6–9 步，才足以進入真正的 Polar → webhook → provision → DNS → gateway reachable 閉環。
