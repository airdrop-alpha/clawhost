# Staging / Real-Credential Runbook

更新時間：2026-03-12

目標閉環：`Polar checkout -> webhook -> provision -> gateway reachable`

這份 runbook 不是本地 mock checklist 的重複版，而是給後續真實 staging 驗證用的「可執行手冊」。

適用場景：
- 要用真實 Polar / provider / Cloudflare 憑證跑一次外部閉環
- 想把風險控制在 staging，不碰 production customer
- 想明確知道每一步該看什麼、失敗了去哪裡查、什麼狀態才算驗證成功

相關文件：
- 本地近似 E2E checklist：[`docs/polar-e2e-checklist.md`](./polar-e2e-checklist.md)
- 目前整體 readiness 審核：[`docs/deployment-readiness-audit-2026-03-12.md`](./deployment-readiness-audit-2026-03-12.md)
- 雲初始化主實作：`apps/api/src/controllers/claws/helpers/generateCloudInit.ts`
- provision 主流程：`apps/api/src/controllers/claws/provisionClaw.ts`
- Polar webhook handler：`apps/api/src/controllers/webhooks/polar.ts`

---

## 1. 這份 runbook 要解決什麼

目前 repo 已經有：
- 本地 webhook replay
- webhook signature contract test
- provision 核心 side effects integration test
- cloud-init smoke test

但還缺的，是一份面向真實外部資源的操作手冊，回答下面這些問題：
- 真實 staging 需要哪些憑證與 env？
- 建議用什麼隔離配置，才能避免誤打 production？
- 最小實跑順序是什麼？
- 每一步如何判斷成功/失敗？
- 出問題時先查哪裡？
- 建出來的機器要如何安全清理？
- 到底什麼狀態才算「gateway reachable」驗證完成？

---

## 2. 驗證前提與範圍

### 2.1 這次驗證覆蓋的鏈路
1. 使用真實使用者 / staging 使用者呼叫 `POST /api/claws/purchase`
2. AlphaClaw 建立 Polar checkout + `pending_claws`
3. 在 Polar 完成真實付款或可觸發 webhook 的測試結帳
4. Polar 呼叫 `/api/webhooks/polar`
5. webhook handler 進入 `provisionClaw()`
6. provider 建立 VPS
7. Cloudflare 建立 subdomain DNS record
8. VM cloud-init 安裝 OpenClaw + nginx + certbot + firewall
9. Gateway 在 VM 內 loopback `:18789` 可回應
10. 外網 `https://<subdomain>.<domain>/` 可連到 gateway

### 2.2 這次驗證**不**涵蓋
- production 正式上線
- 大規模壓測
- 多 provider matrix 一次全驗
- 對外公告、對客戶開放、公開部署

---

## 3. 真實憑證 / env checklist

建議先在 `apps/api/.env.staging`（或安全的 secret manager）整理，不要直接覆蓋 production env。

### 3.1 API 基礎
必填：

```bash
PORT=2222
CLIENT=https://staging-web.example.com
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=32+ chars stable secret
NODE_ENV=production
```

說明：
- `DATABASE_URL` 要指向 **獨立 staging DB**，不要共用 production。
- `ENCRYPTION_KEY` 必須穩定，否則 `rootPassword` / `gatewayToken` 解密會出事。
- `CLIENT` 需與實際 staging web domain 一致，避免 Polar / Firebase redirect 混亂。

### 3.2 Firebase
必填：

```bash
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

建議：
- 使用獨立 Firebase staging project。
- staging web domain 要加到 Firebase authorized domains。

### 3.3 Polar
必填：

```bash
POLAR_ACCESS_TOKEN=...
POLAR_ORGANIZATION_ID=...
POLAR_WEBHOOK_SECRET=...
```

以及至少一個 plan/product mapping：

```bash
POLAR_PRODUCT_HETZNER_CX23=...
# 或其他實際要測的 provider/plan
```

補充：
- `POST /api/claws/purchase` 會用 `provider + planId` 去找對應 `POLAR_PRODUCT_*`。
- 若 env 沒配對，purchase 會直接回 `paymentNotConfigured`。
- 若要生成多個 Polar 產品，可用 repo 內的 `apps/api/scripts/create-polar-products.ts`。

### 3.4 Cloud provider
至少一組可用即可：

```bash
HETZNER_API_TOKEN=...
# 或
DIGITALOCEAN_API_TOKEN=...
# 或
VULTR_API_TOKEN=...
```

建議：
- 第一輪只選 **一個 provider**，先跑通，不要三家同時測。
- 優先選你最熟、計費最可控、API 最穩的那一家。

### 3.5 Cloudflare
必填：

```bash
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
```

注意：
- token 至少要能改 DNS。
- zone 請使用 **staging 子域或獨立測試域**，不要先動 production 主域。

### 3.6 Email / Resend
若 staging 會走 magic link：

```bash
RESEND_API_KEY=...
FROM_EMAIL=OpenClaw <noreply@staging.example.com>
```

如果這次只是 API/operator 驗證，可不把 email 當主阻塞，但至少要確保登入方式能用。

### 3.7 Web app env
`apps/web/.env` 至少要有：

```bash
VITE_API_URL=https://staging-api.example.com/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## 4. 建議的 staging 配置

## 4.1 隔離原則
建議 staging 至少做到這些隔離：
- **獨立 DB**
- **獨立 Firebase project**
- **獨立 Polar org / 至少獨立 products + webhook secret**
- **獨立 DNS 範圍**（例如 `*.staging.example.com`）
- **單一測試 provider + 單一測試 plan**
- **單一內部測試帳號**

## 4.2 建議最小配置
這是最保守、最容易跑通的一套：

- Provider：Hetzner
- Plan：一個符合最低記憶體門檻的低價方案（目前程式要求 `memory >= 4GB`）
- Region：固定單一 region
- Domain：`*.staging.<your-domain>`
- API / Web：各一套 staging deployment
- DB：空白或近空白 staging DB
- User：單一內部測試帳號

## 4.3 為什麼先只測一條主線
因為這條鏈上最容易失敗的是外部系統交界面：
- Polar product / webhook 配錯
- provider plan 或 location 不符
- Cloudflare zone / token 權限不足
- cloud-init 在真機 image 上失敗
- DNS / certbot 時序問題

先把一條最窄主線打通，再擴 provider matrix，成本最低。

---

## 5. 先決檢查：正式實跑前 10 分鐘 checklist

在按下第一筆真實 checkout 前，先確認：

- [ ] `pnpm --filter api test` 綠燈
- [ ] `pnpm --filter api typecheck` 綠燈
- [ ] staging API 已啟動，且可對外接 webhook
- [ ] staging web 可登入
- [ ] staging DB migrations 已完成
- [ ] `POLAR_PRODUCT_*` 已覆蓋本次要測的 `provider + planId`
- [ ] provider token 可列出 server types / locations
- [ ] Cloudflare token 可改目標 zone DNS
- [ ] 測試 domain 已確定，不會碰 production customer domain
- [ ] 有預留 rollback / cleanup 權限（provider delete server、Cloudflare delete record、DB 可查）

---

## 6. 最小實跑順序（推薦）

這裡刻意拆成兩段：
- A 段：真實 purchase + 真實 webhook + 真實 provision
- B 段：真機驗證 gateway reachable

### Step 0 — 本地 / staging 健康檢查
執行：

```bash
pnpm --filter api test
pnpm --filter api typecheck
```

驗證點：
- `polar.contract.test.ts` 通過
- `provisionClaw.integration.test.ts` 通過
- `generateCloudInit.test.ts` 通過

若失敗：
- 不要進入真實付款。
- 先修 repo 健康，避免把外部資源與程式 bug 混在一起。

### Step 1 — 啟動 staging API / Web
目標：確保 `/api/claws/purchase` 與 `/api/webhooks/polar` 是可用的。

驗證點：
- API 可回應
- Web 可登入或至少能拿到 Bearer token
- staging deployment 讀到正確 env

建議額外確認：
- `POLAR_WEBHOOK_SECRET` 已載入
- `CLIENT` 指向 staging web

### Step 2 — 先做「不付款」的 purchase 前校驗
用 staging 使用者打一次：
- plans API
- locations API
- 如可行，從 UI 選定 provider / plan / location

確認：
- plan 的記憶體 >= 4GB
- location 是 provider API 真的存在且未 disabled
- 前端顯示 price 與 provider 計算值一致

原因：
`/api/claws/purchase` 內部會重新校驗 provider plan / location / price，這一步如果不先確認，後面很容易卡在 `invalidPlan` 或 `invalidLocation`。

### Step 3 — 建立真實 checkout
呼叫：
- UI 下單
- 或直接 `POST /api/claws/purchase`

成功時應拿到：
- `checkoutUrl`
- `checkoutId`
- `pendingClawId`
- `expiresAt`
- `priceMonthly`

驗證點：
- API 200 成功
- DB `pending_claws` 新增一筆資料
- 該筆資料包含：
  - `checkout_id`
  - `provider`
  - `plan_id`
  - `location`
  - `root_password`
  - `model` / `api_token`（若本次有填）
  - `expires_at`

若這一步失敗，先查：
- `paymentNotConfigured` → 沒配對到 `POLAR_PRODUCT_*`
- `invalidPlan` / `invalidLocation` → provider 參數不一致
- `userNotFound` / `sshKeyNotFound` → staging 使用者資料不完整

### Step 4 — 在 Polar 完成一次真實 checkout
做法：
- 使用 staging 專用 checkout / product 完成一次真實支付流程
- 若 Polar 支援測試模式或測試卡，優先用測試模式
- 若沒有 sandbox，而只能真實付費，務必先把 product 價格降到最小、並限定內部帳號使用

驗證點：
- Polar 後台可看到 checkout succeeded / subscription active
- webhook delivery 有送到 staging API

### Step 5 — 驗證 webhook 有被 API 接住
目標端點：
- `POST /api/webhooks/polar`

程式邏輯重點：
- `checkout.updated(status=succeeded)` 可能直接觸發 provision
- `subscription.active` 也可能觸發 provision
- 若同 subscription 已經有 claw，`subscription.active` 應該 idempotent，不會重複建機

驗證點：
- API 收到 webhook 後回 `200` + `{ received: true }`
- 沒有出現 invalid signature
- 沒有 webhook handler 500

排查優先順序：
1. Polar webhook delivery log
2. API application log
3. `POLAR_WEBHOOK_SECRET` 是否與 Polar 後台一致
4. request path 是否真的是 `/api/webhooks/polar`

### Step 6 — 驗證 provision 已啟動
`provisionClaw()` 成功啟動後，預期會做這些事：
- claim / delete `pending_claws`
- insert `claws`
- 生成 subdomain + gateway token + cloud-init
- 呼叫 provider `createServer`
- 嘗試建立 Cloudflare DNS record
- 更新 `claws.status = configuring`
- 有 volume 的話建立 volume row

驗證點：
- 原 `pending_claws` 那筆資料已消失（表示被 claim）
- `claws` 新增一筆新記錄
- 該記錄含：
  - `polar_subscription_id`
  - `polar_product_id`
  - `polar_customer_id`
  - `subdomain`
  - `gateway_token`（加密後）
  - `status = configuring`
  - `provider_server_id`
  - `ip`

若這一步失敗，先查：
- API log 是否出現 `Provision claw error`
- provider createServer 是否失敗
- 若 provider 失敗，程式會 rollback 已插入 claw row
- Cloudflare 建 DNS 失敗目前只會 log，不會中止 provision 主流程

### Step 7 — 驗證 provider 真的建出主機
到 provider 後台確認：
- server 已建立
- IP 與 DB 一致
- location / plan 正確
- 若有 volume，volume 已附掛

驗證點：
- provider server 狀態顯示 running
- 主機在合理時間內完成開機

若失敗：
- provider quota / billing / token scope
- image 問題
- region 沒容量

### Step 8 — 驗證 DNS record 已建立
到 Cloudflare 後台確認：
- `<subdomain>.<domain>` A record 已建立且指向該 IP

驗證點：
- DNS record 存在
- `host <subdomain>.<domain> 1.1.1.1` 可解析到預期 IP

注意：
- `provisionClaw()` 裡 DNS 建立失敗只會記錄錯誤，不會讓整個 flow 失敗；所以一定要手動確認這一步。

### Step 9 — 驗證 VM 內部 gateway 起來了
這一步要進 VM。repo 已有 diagnostics / logs 能力，底層也是用 SSH 去查。

VM 內最重要的驗證點：

```bash
systemctl status openclaw-gateway
ss -tlnp | grep 18789
curl -sf http://127.0.0.1:18789
```

預期：
- `openclaw-gateway.service` 存在且 active
- port `18789` 在 loopback 監聽
- `curl http://127.0.0.1:18789` 有回應

還要查：
```bash
tail -100 /var/log/openclaw-gateway.log
nginx -t
systemctl status nginx
```

若 gateway 沒起來：
- 先看 `/var/log/openclaw-gateway.log`
- 再看 systemd service 狀態
- 必要時可用 admin repair 流程（對應 `repairClaw.ts`）

### Step 10 — 驗證 HTTPS / external reachability
目標：從外網訪問：

```bash
https://<subdomain>.<domain>/
```

驗證點：
- DNS 已解析
- nginx 正常代理到 `127.0.0.1:18789`
- certbot 已成功簽發證書
- HTTPS 可連通，不是 timeout / 525 / 502 / 404 on wrong host

建議至少驗證：
```bash
curl -I https://<subdomain>.<domain>/
```

如果首頁需要 token 或 UI 才能完整判斷，再進一步用瀏覽器實測一次。

### Step 11 — 驗證 status 是否能進到 running
程式邏輯中，`syncClaw()` 會在這些條件成立後把狀態從 `configuring` 推進到 `running`：
- provider server status = `running`
- subdomain check ready

因此驗證點是：
- 呼叫 sync 後，`claws.status` 進入 `running`
- IP 保持正確

如果實際 gateway 已可用，但 DB 還卡在 `configuring`，通常代表：
- subdomain readiness check 還沒通過
- DNS propagation 還沒完成

---

## 7. 每一步的驗證點速查表

| 階段 | 成功訊號 | 主要失敗點 |
|---|---|---|
| purchase | 回 `checkoutUrl / pendingClawId` | `POLAR_PRODUCT_*` 缺失、plan/location 不符 |
| pending | `pending_claws` 有新資料 | DB / auth / payload 問題 |
| Polar checkout | checkout succeeded / subscription active | product 配錯、付款流程失敗 |
| webhook | `/api/webhooks/polar` 回 200 | signature 錯、endpoint 錯、API 沒對外 |
| provision | `claws` 新增、`status=configuring` | provider 建機失敗、pending claim 問題 |
| provider | VPS running | quota、token、region 容量 |
| DNS | A record 存在且可解析 | Cloudflare token/zone 錯、propagation |
| VM gateway | 18789 監聽、curl loopback 成功 | cloud-init / service / model env 問題 |
| HTTPS | `https://subdomain` 可訪問 | certbot、nginx、DNS、80/443 |
| final status | `claws.status=running` | readiness check 未通過 |

---

## 8. 什麼條件下才算「gateway reachable」驗證成功

不要只看 provider server 建好了，也不要只看 DNS record 出現。

**本 runbook 對「gateway reachable」的成功定義是：**

### 必要條件（全部都要成立）
- [ ] provider server 已建立，且狀態為 running
- [ ] Cloudflare DNS record 已建立，且解析到正確 IP
- [ ] VM 內 `openclaw-gateway.service` 為 active
- [ ] VM 內 `curl http://127.0.0.1:18789` 成功
- [ ] VM 內 nginx 正常
- [ ] 外網 `https://<subdomain>.<domain>/` 可連通
- [ ] 若執行 sync，`claws.status` 能進到 `running`

### 最低可接受證據
至少保留這些證據截圖或輸出：
1. Polar webhook delivery success
2. DB 中新 `claws` row
3. provider server running 截圖 / API 回應
4. Cloudflare DNS record 截圖 / `host` 結果
5. `systemctl status openclaw-gateway`
6. `curl http://127.0.0.1:18789`
7. `curl -I https://<subdomain>.<domain>/`

只要少一個，這次就不算完整閉環成功。

---

## 9. 常見失敗點與排查

## 9.1 purchase 階段失敗
### 症狀
- `/api/claws/purchase` 400
- 回 `paymentNotConfigured` / `invalidPlan` / `invalidLocation`

### 先查
- `POLAR_PRODUCT_*` 是否覆蓋本次 provider + planId
- provider API 回傳的 plan 名稱是否與 env key 對得上
- location 是否存在且未 disabled
- 前端 price 是否與 provider 實算價格一致

## 9.2 webhook 沒打進來
### 症狀
- Polar 顯示 webhook failed
- API 沒 log

### 先查
- webhook URL 是否為 staging API 的 `/api/webhooks/polar`
- staging API 是否真的可被 Polar 從外網訪問
- TLS / reverse proxy 是否正常
- `POLAR_WEBHOOK_SECRET` 是否一致

## 9.3 webhook 打進來但沒 provision
### 症狀
- webhook 200 但沒建機

### 先查
- payload 裡有沒有 `pendingClawId / subscriptionId / customerId / productId`
- `checkout.updated` 是否真的是 `status=succeeded`
- `subscription.active` 是否因為既有 `polarSubscriptionId` 而被 idempotent skip

## 9.4 provider 建機失敗
### 症狀
- `Provision claw error`
- provider 後台沒機器

### 先查
- provider token scope
- quota / billing / project 狀態
- region 容量
- plan 是否可用

### 程式行為
- `createServer` 失敗時，已插入的 `claws` row 會 rollback 刪掉。

## 9.5 DNS 沒建起來
### 症狀
- VM 起來了，但 domain 不通

### 先查
- Cloudflare token / zone id
- API log 裡 `Failed to create DNS record`
- record 是否建立到錯的 zone

### 注意
- 目前 DNS 建立失敗不會讓 provision fail-fast，所以這一步一定要額外人工確認。

## 9.6 gateway service 沒起來
### 症狀
- 18789 沒監聽
- `curl 127.0.0.1:18789` 失敗

### 先查
- `systemctl status openclaw-gateway`
- `/var/log/openclaw-gateway.log`
- Node / OpenClaw 是否安裝成功
- 若指定 model，需要的 provider API key env 是否有被寫進 config

## 9.7 HTTPS 不通或 certbot 失敗
### 症狀
- `https://subdomain` timeout / 525 / SSL error

### 先查
- 80/443 是否開放（cloud-init 有設定 UFW，但 provider 上游規則也要看）
- DNS 是否已先解析到正確 IP
- nginx config 是否 OK
- certbot 是否在 DNS 尚未解析完成前就執行失敗

---

## 10. rollback / cleanup

原則：這次驗證是 staging，任何成功或失敗的殘留資源都應該能收乾淨。

## 10.1 成功後 cleanup
若這次只是驗證，不打算保留機器：
- 刪除 provider server
- 刪除附加 volume
- 刪除 Cloudflare DNS record
- 視需要刪除 `claws` / `pending_claws` staging 資料
- 視 Polar 測試策略取消 subscription，避免後續再扣費

repo 內已存在的清理主邏輯：
- `apps/api/src/controllers/claws/helpers/cleanupClaw.ts`

該流程會嘗試：
- detach + delete volume
- delete DNS record
- delete provider server
- delete DB claw row

## 10.2 失敗後 cleanup
### 情境 A：pending 建了，但 webhook 沒走
- 刪除過期或測試用 `pending_claws`
- 關閉 / 取消該 checkout 或 subscription

### 情境 B：server 建出來，但 DNS / gateway 失敗
- 若要重跑，建議直接整台刪掉重建，比在半殘 VM 上硬修更乾淨
- 同步刪除 DNS record 與 volume

### 情境 C：DNS 建了，但 provider server 沒留
- 直接刪掉孤兒 DNS record，避免誤導

### 情境 D：subscription 已 active，但本輪驗證作廢
- 在 Polar 停用 / 取消訂閱，避免後續 webhook 持續影響 staging

---

## 11. 推薦的實跑記錄模板

建議每次實跑都記一份：

```md
# Polar real-credential staging run - YYYY-MM-DD

## Env snapshot
- API deploy: ...
- Web deploy: ...
- Provider: ...
- Plan: ...
- Region: ...
- Domain: ...

## Purchase
- checkoutId:
- pendingClawId:
- result:

## Webhook
- delivery id:
- event type:
- status:

## Provision
- clawId:
- providerServerId:
- ip:
- subdomain:

## VM checks
- gateway service:
- curl 127.0.0.1:18789:
- nginx:
- certbot:

## External checks
- host result:
- curl -I https://subdomain:
- final status:

## Cleanup
- server deleted:
- dns deleted:
- volume deleted:
- subscription canceled:
```

---

## 12. 還缺什麼才可以實跑真實外部閉環

在 repo 已具備目前主線程式與測試前提下，真正開跑前還差這些外部條件：

1. **一套隔離好的 staging secrets**
   - 至少 DB / Firebase / Polar / provider / Cloudflare 全部齊
2. **一個可對外接收 Polar webhook 的 staging API**
3. **一個可登入的 staging web 或可直接打 API 的內部測試帳號**
4. **至少一個已建立好的 Polar product 對應本次 plan**
5. **一個成本受控的測試方案**
6. **一個明確的 cleanup owner**
   - 誰負責刪機、刪 DNS、取消訂閱，先講清楚

---

## 13. 建議執行順序（最短路徑）

如果目標是最快得到第一個真實閉環結果，建議按這個順序：

1. 整理 staging env/secrets
2. 部署 staging API / web
3. 驗證 migrations / login / plans / locations
4. 確認 Polar product mapping
5. 跑一次真實 `purchase`
6. 在 Polar 完成一次測試 checkout
7. 看 webhook delivery
8. 看 DB `pending -> claws`
9. 看 provider server / DNS
10. SSH 進 VM 查 gateway / nginx / certbot
11. 驗證 `https://subdomain`
12. cleanup 全部測試資源

這樣最不容易在多變量情況下迷路。
