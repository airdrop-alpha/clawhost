export type ClawTier = 'basic' | 'pro' | 'enterprise'

function getProviderEnvVar(model: string): string | null {
    if (model.startsWith('anthropic/')) return 'ANTHROPIC_API_KEY'
    if (model.startsWith('openai/')) return 'OPENAI_API_KEY'
    if (model.startsWith('google/')) return 'GEMINI_API_KEY'
    return null
}

/**
 * Default SOUL.md template (Chinese-friendly) for new OpenClaw instances.
 */
function getDefaultSoulMd(tier: ClawTier): string {
    const base = `# SOUL.md — 你的 AI 助手

你是一個智能 AI 助手，運行在 OpenClaw 平台上。

## 核心特質
- 🌐 雙語溝通：中文和英文都能流暢使用
- 🤝 友善且專業
- 🔒 注重安全和隱私

## 行為準則
- 回答要簡潔有力，避免廢話
- 不確定的事情要誠實說明
- 涉及資金操作時要特別謹慎，確認後再執行
`

    if (tier === 'pro' || tier === 'enterprise') {
        return (
            base +
            `
## 💰 Crypto 能力
你已預裝 Coinbase Agentic Wallet Skills，可以：
- 認證和管理錢包 (authenticate-wallet)
- 充值 (fund)
- 發送 USDC (send-usdc)
- 交易 (trade)
- 搜索 x402 付費服務 (search-for-service)
- 使用 x402 付費服務 (pay-for-service)

執行任何資金相關操作前，務必向用戶確認。
`
        )
    }

    return base
}

/**
 * Default AGENTS.md template for new instances.
 */
function getDefaultAgentsMd(): string {
    return `# AGENTS.md

## 每次啟動
1. 讀取 SOUL.md — 了解你是誰
2. 讀取最近的對話記錄

## 安全
- 不要洩露私密資料
- 破壞性操作前要確認
- 有疑問就問

## 工具
使用你可用的 skills 來完成任務。Crypto 相關操作請特別小心。
`
}

export default function generateCloudInit(
    rootPassword: string,
    subdomain: string,
    domain: string,
    gatewayToken: string,
    model?: string,
    apiToken?: string,
    tier: ClawTier = 'basic',
    customSkills?: string[]
): string {
    const fullDomain = `${subdomain}.${domain}`

    const config: Record<string, unknown> = {
        gateway: {
            mode: 'local',
            auth: {
                mode: 'token',
                token: gatewayToken
            },
            controlUi: {
                allowInsecureAuth: true
            },
            trustedProxies: ['127.0.0.1', '::1']
        },
        channels: {
            whatsapp: { dmPolicy: 'open', allowFrom: ['*'] },
            telegram: { dmPolicy: 'open', allowFrom: ['*'] },
            discord: {},
            slack: {},
            signal: { dmPolicy: 'open', allowFrom: ['*'] },
            imessage: { dmPolicy: 'open', allowFrom: ['*'] }
        }
    }

    const agentDefaults: Record<string, unknown> = {
        sandbox: { mode: 'off' }
    }

    if (model) {
        agentDefaults.model = { primary: model }

        const envVarName = getProviderEnvVar(model)
        if (envVarName && apiToken) {
            config.env = {
                [envVarName]: apiToken
            }
        }
    }

    config.agents = { defaults: agentDefaults }

    const configJson = JSON.stringify(config, null, 2).replace(/\n/g, '\n    ')

    return `#cloud-config

chpasswd:
  list: |
    root:${rootPassword}
  expire: false

package_update: true

packages:
  - curl
  - nginx
  - certbot
  - python3-certbot-nginx
  - ufw
  - ca-certificates
  - gnupg
  - git
  - dnsutils

runcmd:
  - fallocate -l 2G /swapfile
  - chmod 600 /swapfile
  - mkswap /swapfile
  - swapon /swapfile
  - echo '/swapfile none swap sw 0 0' >> /etc/fstab

  - mkdir -p /etc/apt/keyrings
  - curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  - echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  - apt-get update -o Dir::Etc::sourcelist="sources.list.d/nodesource.list" -o Dir::Etc::sourceparts="-" -o APT::Get::List-Cleanup="0"
  - apt-get install -y nodejs

  - npm install -g openclaw@latest

  - useradd -r -m -d /home/openclaw -s /bin/bash openclaw
  - echo 'openclaw ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/openclaw

  - mkdir -p /home/openclaw/.openclaw
  - mkdir -p /home/openclaw/.openclaw/agents/main/agent

  - |
    cat > /home/openclaw/.openclaw/openclaw.json << 'OCCONFIG'
    ${configJson}
    OCCONFIG

  - chown -R openclaw:openclaw /home/openclaw

  - |
    cat > /etc/systemd/system/openclaw-gateway.service <<'SYSTEMD'
    [Unit]
    Description=OpenClaw Gateway
    After=network.target

    [Service]
    Type=simple
    User=openclaw
    Group=openclaw
    WorkingDirectory=/home/openclaw
    Environment=HOME=/home/openclaw
    Environment=NODE_ENV=production
    ExecStart=/usr/bin/openclaw gateway --port 18789 --bind loopback
    Restart=always
    RestartSec=10
    StartLimitIntervalSec=0
    StandardOutput=append:/var/log/openclaw-gateway.log
    StandardError=append:/var/log/openclaw-gateway.log

    [Install]
    WantedBy=multi-user.target
    SYSTEMD

  - systemctl daemon-reload
  - systemctl enable openclaw-gateway
  - systemctl start openclaw-gateway

  - |
    for i in $(seq 1 30); do
      if curl -sf -o /dev/null http://127.0.0.1:18789; then
        break
      fi
      systemctl restart openclaw-gateway 2>/dev/null || true
      sleep 10
    done

  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable

  - |
    cat > /etc/nginx/sites-available/openclaw << 'NGINXEOF'
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;
        return 444;
    }

    server {
        listen 80;
        listen [::]:80;
        server_name ${fullDomain};

        location / {
            proxy_pass http://127.0.0.1:18789;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
        }
    }
    NGINXEOF

  - ln -sf /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/
  - rm -f /etc/nginx/sites-enabled/default
  - mkdir -p /etc/systemd/system/nginx.service.d
  - |
    cat > /etc/systemd/system/nginx.service.d/override.conf <<'NGINXOVERRIDE'
    [Service]
    Restart=always
    RestartSec=5
    NGINXOVERRIDE
  - systemctl daemon-reload
  - nginx -t && systemctl reload nginx
  - systemctl enable nginx

  - |
    for i in $(seq 1 24); do
      if host ${fullDomain} 1.1.1.1 > /dev/null 2>&1; then
        sleep 15
        break
      fi
      sleep 5
    done
  - certbot --nginx -d ${fullDomain} --non-interactive --agree-tos --email ssl@${domain} --redirect

  - echo "0 0,12 * * * root certbot renew --quiet --deploy-hook 'systemctl reload nginx'" > /etc/cron.d/certbot-renew
  - chmod 644 /etc/cron.d/certbot-renew

  - |
    cat > /tmp/install-brew.sh << 'BREWSCRIPT'
    #!/bin/bash
    su - openclaw -c 'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> /home/openclaw/.bashrc
    BREWSCRIPT
    chmod +x /tmp/install-brew.sh
    nohup /tmp/install-brew.sh > /var/log/brew-install.log 2>&1 &

${generateSkillsInstallBlock(tier, customSkills)}
${generateTemplateBlock(tier)}
final_message: "OpenClaw instance ready! Access dashboard at https://${fullDomain}/"
`
}

/**
 * Generate cloud-init runcmd block for installing skills based on tier.
 */
function generateSkillsInstallBlock(tier: ClawTier, customSkills?: string[]): string {
    const blocks: string[] = []

    if (tier === 'pro' || tier === 'enterprise') {
        blocks.push(`  # Install Coinbase Agentic Wallet Skills (crypto suite)
  - |
    su - openclaw -c 'cd /home/openclaw/.openclaw && npx skills add coinbase/agentic-wallet-skills -y' >> /var/log/openclaw-skills.log 2>&1`)
    }

    if (tier === 'enterprise' && customSkills && customSkills.length > 0) {
        const SKILL_PATTERN = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/
        for (const skill of customSkills) {
            // Validate skill name format: owner/skill-name only
            const sanitized = SKILL_PATTERN.test(skill) ? skill : ''
            if (sanitized) {
                blocks.push(`  - |
    su - openclaw -c 'cd /home/openclaw/.openclaw && npx skills add ${sanitized} -y' >> /var/log/openclaw-skills.log 2>&1`)
            }
        }
    }

    return blocks.length > 0 ? blocks.join('\n\n') + '\n' : ''
}

/**
 * Generate cloud-init runcmd block for writing default SOUL.md and AGENTS.md templates.
 */
function generateTemplateBlock(tier: ClawTier): string {
    const soulMd = getDefaultSoulMd(tier).replace(/'/g, "'\\''")
    const agentsMd = getDefaultAgentsMd().replace(/'/g, "'\\''")

    return `  # Write default SOUL.md and AGENTS.md templates
  - |
    cat > /home/openclaw/.openclaw/agents/main/agent/SOUL.md << 'SOULEOF'
${soulMd}
    SOULEOF
  - |
    cat > /home/openclaw/.openclaw/agents/main/agent/AGENTS.md << 'AGENTSEOF'
${agentsMd}
    AGENTSEOF
  - chown -R openclaw:openclaw /home/openclaw/.openclaw/agents

`
}