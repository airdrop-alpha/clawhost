<p align="center">
  <img src="apps/web/public/favicon.ico" alt="AlphaClaw" width="80" />
</p>

<h1 align="center">AlphaClaw</h1>

<p align="center">
  Deploy OpenClaw on your own VPS with one click.<br/>
  Full privacy, dedicated resources, no shared infrastructure.
</p>

<p align="center">
  <a href="https://alphaclaw.dev">Website</a> &middot;
  <a href="https://alphaclaw.dev/posts">Blog</a> &middot;
  <a href="#self-hosting">Self-Host Guide</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-green" alt="Node 20+" />
  <img src="https://img.shields.io/badge/pnpm-9.14%2B-orange" alt="pnpm 9.14+" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
</p>

---

## What is AlphaClaw?

AlphaClaw is an open-source, self-hostable cloud hosting platform that lets anyone deploy [OpenClaw](https://openclaw.dev) on a dedicated VPS in under a minute. It handles server provisioning, DNS, SSL, firewall configuration, and OpenClaw installation automatically — so you can focus on using AI, not managing infrastructure.

### Key Highlights

- **One-Click Deploy** — Select a server, pay, and OpenClaw is live within minutes
- **Dedicated VPS** — Real servers with full root access, not shared containers
- **Automatic SSL** — HTTPS via Let's Encrypt, configured automatically
- **DNS Management** — Automatic subdomain creation via Cloudflare
- **Global Locations** — 6 server regions worldwide (US, Europe, Asia)
- **SSH Key Management** — Store and assign keys for passwordless access
- **Persistent Storage** — Attach additional volumes to any instance
- **Passwordless Auth** — Magic link sign-in, no passwords to remember
- **Billing Built-In** — Polar.sh integration for subscriptions and invoicing
- **Fully Open Source** — MIT licensed, self-host the entire platform yourself

## Architecture

AlphaClaw is a TypeScript monorepo built with [Turborepo](https://turbo.build) and managed with [pnpm](https://pnpm.io).

```
clawhost/
├── apps/
│   ├── api/                 # Hono.js backend API
│   └── web/                 # React + Vite frontend
├── packages/
│   ├── shared/              # @openclaw/shared — HTTP client utility
│   └── i18n/                # @openclaw/i18n — Internationalization
├── scripts/
│   └── cloud-init.yaml      # Server initialization template
├── turbo.json               # Turborepo build orchestration
└── pnpm-workspace.yaml      # Workspace definition
```

### Tech Stack

| Layer                   | Technology                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| **API Framework**       | [Hono](https://hono.dev) on Node.js                                                                             |
| **Database**            | PostgreSQL with [Drizzle ORM](https://orm.drizzle.team)                                                         |
| **Authentication**      | [Firebase](https://firebase.google.com) (passwordless email links)                                              |
| **Server Provisioning** | [Hetzner Cloud API](https://docs.hetzner.cloud)                                                                 |
| **DNS**                 | [Cloudflare API](https://developers.cloudflare.com/api)                                                         |
| **Billing**             | [Polar.sh](https://polar.sh)                                                                                    |
| **Email**               | [Resend](https://resend.com) with React Email                                                                   |
| **Frontend**            | [React 18](https://react.dev) + [Vite](https://vitejs.dev)                                                      |
| **UI Components**       | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://radix-ui.com) + [Tailwind CSS](https://tailwindcss.com) |
| **State Management**    | [Zustand](https://zustand-demo.pmnd.rs)                                                                         |
| **Data Fetching**       | [TanStack React Query](https://tanstack.com/query)                                                              |
| **Icons**               | [Phosphor Icons](https://phosphoricons.com)                                                                     |
| **Animations**          | [Framer Motion](https://www.framer.com/motion)                                                                  |
| **Blog**                | MDX with frontmatter                                                                                            |
| **Monorepo**            | [Turborepo](https://turbo.build) + [pnpm](https://pnpm.io)                                                      |

### Database Schema

| Table          | Purpose                                                               |
| -------------- | --------------------------------------------------------------------- |
| `users`        | Firebase-authenticated users with Polar customer IDs                  |
| `claws`        | Hetzner Cloud server instances (status, IP, subdomain, gateway token) |
| `pendingClaws` | Temporary storage for in-progress checkout sessions                   |
| `sshKeys`      | SSH public keys with Hetzner sync                                     |
| `volumes`      | Persistent storage volumes attached to claws                          |

## Self-Hosting

### Prerequisites

- **Node.js** 20+
- **pnpm** 9.14+
- **PostgreSQL** database (Neon, Supabase, or self-hosted)

### External Services

| Service                                         | Purpose                 | What You Need                         |
| ----------------------------------------------- | ----------------------- | ------------------------------------- |
| [Hetzner Cloud](https://console.hetzner.cloud)  | Server provisioning     | API Token (Read & Write)              |
| [Firebase](https://console.firebase.google.com) | Authentication          | Project credentials + Service account |
| [Cloudflare](https://dash.cloudflare.com)       | DNS management          | API Token + Zone ID                   |
| [Polar.sh](https://polar.sh)                    | Billing & subscriptions | API credentials                       |
| [Resend](https://resend.com)                    | Transactional email     | API Key                               |

### 1. Clone & Install

```bash
git clone https://github.com/bfzli/clawhost.git
cd clawhost
pnpm install
```

### 2. Configure Environment Variables

**API** — create `apps/api/.env`:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Hetzner Cloud
HETZNER_API_TOKEN=your-hetzner-api-token

# Cloudflare DNS
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ZONE_ID=your-zone-id

# Server
PORT=2222
```

**Web** — create `apps/web/.env`:

```bash
# Firebase Client SDK
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Dashboard v1 data source
# Used by apps/web/src/pages/Dashboard.tsx for /events, /zones, /timeline
# Falls back to local mock-safe demo data if unavailable
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# Optional: enables Mapbox GL JS in the dashboard map panel.
# If omitted, the dashboard renders a lightweight SVG fallback map instead.
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token
```

### 3. Set Up External Services

<details>
<summary><strong>Hetzner Cloud</strong></summary>

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud)
2. Create a new project or select an existing one
3. Navigate to **Security** > **API Tokens**
4. Generate a token with **Read & Write** permissions
5. Copy to `HETZNER_API_TOKEN`

</details>

<details>
<summary><strong>Firebase</strong></summary>

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** > **Sign-in method** > **Email link (passwordless)**
4. Add your domain to **Authorized domains**
5. For the web app: **Project Settings** > **General** > **Your apps** > Add a web app and copy config
6. For the API: **Project Settings** > **Service accounts** > Generate a new private key

</details>

<details>
<summary><strong>Cloudflare</strong></summary>

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Add your domain or select an existing one
3. Copy the **Zone ID** from the domain overview page
4. Create an API token with **Zone:DNS:Edit** permission
5. Copy Zone ID and API Token to your `.env`

</details>

<details>
<summary><strong>Polar.sh</strong></summary>

1. Go to [Polar.sh](https://polar.sh)
2. Create an organization and set up your products/subscriptions
3. Configure webhook to point to your API's `/api/webhooks/polar` endpoint
4. Copy API credentials to your `.env`

</details>

### 4. Initialize Database

```bash
pnpm --filter api db:migrate
```

### 5. Start Development

```bash
pnpm dev
```

This starts both apps:

| App | URL                   |
| --- | --------------------- |
| Web | http://localhost:1111 |
| API | http://localhost:2222 |

The web dev server proxies `/api` requests to the API server automatically.

## Scripts

### Root Commands

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `pnpm dev`          | Start all apps in development mode               |
| `pnpm dev:web`      | Start web app only                               |
| `pnpm dev:api`      | Start API only                                   |
| `pnpm build`        | Build all apps for production                    |
| `pnpm lint`         | Run ESLint across the monorepo                   |
| `pnpm lint:fix`     | Auto-fix ESLint issues                           |
| `pnpm format`       | Format all files with Prettier                   |
| `pnpm format:check` | Check formatting without writing                 |
| `pnpm check`        | Run TypeScript type-check + ESLint for both apps |

### Database Commands

| Command                         | Description                                   |
| ------------------------------- | --------------------------------------------- |
| `pnpm --filter api db:generate` | Generate a new migration after schema changes |
| `pnpm --filter api db:migrate`  | Apply pending migrations                      |
| `pnpm --filter api db:studio`   | Open Drizzle Studio (database GUI)            |
| `pnpm --filter api test`        | Run API smoke/unit tests                      |

### Email Development

```bash
pnpm --filter api email:dev    # Preview email templates at localhost:3333
```

## API Reference

### Public Endpoints

| Method | Endpoint                    | Description                   |
| ------ | --------------------------- | ----------------------------- |
| `GET`  | `/api/plans`                | List available server plans   |
| `GET`  | `/api/plans/locations`      | List available regions        |
| `GET`  | `/api/plans/volume-pricing` | Get volume pricing            |
| `POST` | `/api/auth/send-magic-link` | Send passwordless login email |

### Protected Endpoints (Bearer token required)

**Claws (Server Instances)**

| Method   | Endpoint                         | Description                 |
| -------- | -------------------------------- | --------------------------- |
| `GET`    | `/api/claws`                     | List all claws              |
| `GET`    | `/api/claws/:id`                 | Get a specific claw         |
| `POST`   | `/api/claws`                     | Create a claw (direct)      |
| `POST`   | `/api/claws/purchase`            | Initiate paid claw purchase |
| `POST`   | `/api/claws/:id/sync`            | Sync claw with Hetzner      |
| `POST`   | `/api/claws/:id/start`           | Start a claw                |
| `POST`   | `/api/claws/:id/stop`            | Stop a claw                 |
| `POST`   | `/api/claws/:id/restart`         | Restart a claw              |
| `POST`   | `/api/claws/:id/cancel-deletion` | Cancel scheduled deletion   |
| `DELETE` | `/api/claws/:id`                 | Delete a claw               |

**SSH Keys**

| Method   | Endpoint            | Description       |
| -------- | ------------------- | ----------------- |
| `GET`    | `/api/ssh-keys`     | List SSH keys     |
| `POST`   | `/api/ssh-keys`     | Add an SSH key    |
| `DELETE` | `/api/ssh-keys/:id` | Delete an SSH key |

**Users**

| Method | Endpoint                                 | Description               |
| ------ | ---------------------------------------- | ------------------------- |
| `GET`  | `/api/users/me`                          | Get current user profile  |
| `PUT`  | `/api/users/me`                          | Update profile            |
| `GET`  | `/api/users/me/stats`                    | Get user stats            |
| `GET`  | `/api/users/me/billing`                  | Get billing history       |
| `GET`  | `/api/users/me/billing/:orderId/invoice` | Get invoice for an order  |
| `POST` | `/api/users/me/billing/portal`           | Open Polar billing portal |

### Webhooks

| Method | Endpoint              | Description           |
| ------ | --------------------- | --------------------- |
| `POST` | `/api/webhooks/polar` | Polar payment webhook |

For a local replayable verification path, see [`docs/polar-e2e-checklist.md`](docs/polar-e2e-checklist.md).

For a real-credential staging validation runbook (Polar → webhook → provision → gateway reachable), see [`docs/staging-real-credential-runbook.md`](docs/staging-real-credential-runbook.md).

For staging secret ownership / collection planning, see [`docs/staging-secret-matrix.md`](docs/staging-secret-matrix.md).

For copyable staging env templates, see [`apps/api/.env.staging.example`](apps/api/.env.staging.example) and [`apps/web/.env.staging.example`](apps/web/.env.staging.example).

## Deployment

### Web App

The web app builds to `apps/web/dist/` as a static SPA with pre-rendered pages and a generated sitemap. Deploy to any static hosting provider:

- **Vercel** (includes `vercel.json` with SPA rewrites)
- Cloudflare Pages
- Netlify
- Nginx / Apache

```bash
pnpm build
```

### API

The API runs as a Next.js application (Hono mounted on Next.js for deployment flexibility):

```bash
cd apps/api
pnpm build
pnpm start    # Starts on port 2222
```

## How It Works

When a user deploys a new claw, the platform:

1. **Creates a checkout** — Initiates a Polar.sh subscription for the selected plan and stores a `pending_claw`
2. **Consumes Polar webhooks** — `checkout.updated` and `subscription.active` can both trigger the provisioning path
3. **Provisions a server** — Spins up a VPS in the chosen region using the selected provider
4. **Runs cloud-init** — Automatically installs Node.js, OpenClaw, Nginx, SSL, and firewall
5. **Configures DNS** — Creates a Cloudflare subdomain pointing to the server IP
6. **Delivers access** — User gets a subdomain URL, root password, and gateway token

A step-by-step local verification checklist (including mock webhook replay) lives in [`docs/polar-e2e-checklist.md`](docs/polar-e2e-checklist.md).

The generated cloud-init script (`apps/api/src/controllers/claws/helpers/generateCloudInit.ts`) configures every new instance with:

- Node.js 22 runtime
- OpenClaw (installed globally via npm)
- Nginx reverse proxy with WebSocket support
- Let's Encrypt SSL certificates
- UFW firewall (ports 22, 80, 443)
- systemd service for automatic OpenClaw startup

## Customization

### Subdomain Pattern

Instances get subdomains like `abc1234.yourdomain.com`. To use your own domain, update the Cloudflare zone configuration and the cloud-init template.

### Pricing Markup

The default pricing markup on Hetzner base prices is configurable in the plans controller.

### Cloud-Init

Modify `scripts/cloud-init.yaml` to customize what gets installed on new instances — add packages, change Node.js version, or configure additional services.

### Internationalization

All UI text is managed through `@openclaw/i18n`. Translation strings live in `packages/i18n/src/langs/en.ts`, organized by category (`common`, `nav`, `auth`, `dashboard`, `landing`, etc.).

## Troubleshooting

<details>
<summary><strong>SSL certificates not working</strong></summary>

Instances may take 1-2 minutes for SSL certificates to provision after the server boots. The cloud-init script includes retry logic for certificate generation. Ensure ports 80 and 443 are open.

</details>

<details>
<summary><strong>DNS not resolving</strong></summary>

New subdomains may take 1-5 minutes to propagate through Cloudflare. Check that your Cloudflare API token has Zone:DNS:Edit permission and the Zone ID is correct.

</details>

<details>
<summary><strong>Firebase auth not working</strong></summary>

1. Verify your domain is listed in Firebase **Authorized domains**
2. Confirm email link sign-in is enabled under **Authentication** > **Sign-in method**
3. Double-check that all `VITE_FIREBASE_*` values match your Firebase project

</details>

<details>
<summary><strong>Database connection errors</strong></summary>

1. Verify `DATABASE_URL` is correct and includes `?sslmode=require` for hosted databases
2. Run `pnpm --filter api db:migrate` to apply any pending migrations
3. Use `pnpm --filter api db:studio` to inspect the database directly

</details>

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Make your changes following the project's code conventions
4. Run `pnpm check` to verify TypeScript and linting pass
5. Run `pnpm format` to ensure formatting is correct
6. Commit and push your changes
7. Open a pull request

## License

MIT License — see [LICENSE](LICENSE) for details.
