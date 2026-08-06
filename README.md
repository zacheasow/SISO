# Kumon SISO — Student Check-In & Pickup System

A **local-first**, standalone student attendance, drop-off acknowledgment, parent pickup, and checkout application. Runs entirely on your center's own computer with zero cloud dependencies, zero distributor licensing, and zero external tracking.

---

## Features

| Feature | Description |
|---|---|
| **QR Check-In** | Students scan a printed QR card on a tablet to check in instantly |
| **Offline-First** | Check-ins record locally on the tablet even when Wi-Fi drops — syncs automatically when reconnected |
| **PWA Web Push Notifications** | Parents receive zero-cost lock-screen push notifications via the PWA interface (iOS, Android, Desktop) |
| **Staff Checkout** | Students are only physically released when staff taps "Complete Checkout" — parent request alone does **not** release the student |
| **Override System** | Staff can override any workflow step with a shared PIN + mandatory written reason |
| **CSV Roster Import** | Import student rosters from any spreadsheet export with flexible column auto-detection |
| **Printable QR Cards** | Generate 8-card-per-page PDF sheets with center logo, student name, and secure QR code |
| **2-Year History** | Full attendance audit trail with duration calculations, drop-off/pickup status, and CSV export |
| **Backup & Transfer** | Move your entire installation to a new computer via USB — no distributor needed |
| **Device Pairing** | Pair multiple tablets to one main computer over local Wi-Fi |
| **Cloudflare Quick Tunnel** | One-click public tunneling for remote parent access — no DNS, no port forwarding, no cost |
| **Admin Security Scoping** | Sensitive admin endpoints (roster, config) are blocked over the public tunnel; only parent-facing routes are exposed |

---

## Prerequisites

- **Node.js** v18 or later — [Download here](https://nodejs.org/)
- **npm** v9+ (included with Node.js)
- A modern web browser (Chrome, Edge, Firefox)

That's it. No database servers, no Docker, no cloud accounts.

---

## 🚀 Zero-Terminal Quick Start (Double-Click Launchers)

Your staff does **not** need to open a terminal or run any commands!

### On Windows
1. **First Time / Every Day:** Double-click **`Start-KumonSISO-Windows.cmd`** (or **`Start-KumonSISO-Windows.vbs`** for completely silent startup without any pop-up window).
2. It automatically checks dependencies, installs/builds if needed, starts the background server (bound to `127.0.0.1` to avoid firewall prompts), polls the health endpoint until the server is ready, and opens **Desktop Admin** and **Check-In PWA** in your default browser.

> **Will Windows Defender / SmartScreen block it?**  
> No. Scripts created directly on your machine (like `.cmd` or `.vbs`) do not trigger SmartScreen warnings because Windows recognizes them as local user scripts. Only untrusted `.exe` files downloaded from the internet without a digital code-signing certificate trigger SmartScreen prompts.

### On macOS
1. Double-click **`Start-KumonSISO-Mac.command`** in Finder.
2. It will start the server and automatically launch your browser to the app.

---

## 📱 Connecting Tablets (In-App Guide)

No commands needed on tablets either!

1. Make sure your tablet (iPad, Android, Windows surface) is on the same Wi-Fi as the main computer.
2. Open the **Desktop Admin** on the main computer and go to **Check-in Tablets & Devices**.
3. The app will auto-detect your main computer's IP address and display it (e.g. `http://192.168.1.42:5173`).
4. Type that address into your tablet's browser (Safari/Chrome).
5. Tap **Share → Add to Home Screen** on iPad, or **Menu (⋮) → Add to Home Screen** on Android for a full-screen kiosk app!

---

## 🔔 Parent Notifications (PWA Web Push)

Kumon SISO uses **PWA Web Push (VAPID)** to send zero-cost lock-screen notifications to parents — no Twilio, no Telegram, no per-message costs.

### How It Works

1. **Parents open the parent link** on their phone and tap **"Add to Home Screen"** to install the PWA.
2. The PWA prompts for notification permission — once granted, all future drop-off/pickup alerts arrive as real push notifications, even when the app isn't open.
3. The center director configures VAPID keys in **Desktop Admin → Network & Notifications**.

### Configuration

| Setting | Description |
|---|---|
| **VAPID Public Key** | Generated key pair for Web Push (the public half) |
| **VAPID Private Key** | The private half — never shared |
| **Notification Provider** | `WEB_PUSH` (production) or `DEV_OUTBOX` (testing — writes JSON files to `sms_outbox/`) |

> **Local Dev Outbox mode** is the default. When set to `DEV_OUTBOX`, no real notifications are sent — instead, JSON files are written to `sms_outbox/` for testing and debugging.

---

## 🌐 Cloudflare Quick Tunnel (Optional Remote Access)

For centers that want parents to receive notifications and acknowledge drop-offs from **outside** the local Wi-Fi network:

1. Open **Desktop Admin → Network & Notifications**.
2. Toggle **Enable Cloudflare Quick Tunnel** to ON.
3. The system automatically spawns a `cloudflared` tunnel and displays the public URL (e.g. `https://xxxx-yyyy.trycloudflare.com`).
4. Share this URL with parents — they can access the parent-facing PWA from anywhere.

### Security Scoping

When the tunnel is active, a Fastify request hook **blocks** all admin-sensitive routes (`/api/students`, `/api/config`, etc.) when accessed from a `trycloudflare.com` domain. Only parent-facing endpoints (`/api/parent/*`, health checks) are accessible over the public tunnel. Admin routes remain fully accessible over `localhost` / `127.0.0.1`.

> **No cost, no DNS, no port forwarding.** Cloudflare Quick Tunnels are free and require no Cloudflare account.

---

## Setting Up on Another Computer

### Option A — Fresh Install (Recommended for New Centers)

1. **Copy the project folder** to the new computer via USB, network share, or Git.

2. **Install Node.js** on the new computer if not already installed.

3. **Double-click the launcher** (`Start-KumonSISO-Windows.cmd` or `Start-KumonSISO-Mac.command`). It will auto-install dependencies and build on first run.

   Or manually:
   ```bash
   npm install
   npm run build
   npm run start:server
   ```

4. Open `http://localhost:5174` to launch the **Desktop Admin** and complete the **Onboarding Wizard** (set center name, phone, time zone, staff PIN).

5. Import your student roster CSV, generate QR cards, and pair tablets.

### Option B — Transfer an Existing Installation (Keep All Data)

Use this when you already have student records, attendance history, and QR codes on the old computer and want everything on the new one.

**On the old computer:**

1. Open the Desktop Admin → **Backup & Computer Move**.
2. Click **Export Transfer Package**.
3. Copy the generated folder (e.g. `export_packages/kumon_siso_migration_2026-...`) to a USB drive.

**On the new computer:**

1. Copy the project folder and the transfer package folder to the new computer.
2. Install dependencies:
   ```bash
   npm install
   npm run build
   ```
3. Copy the `database.sqlite` file from the transfer package into `./data/kumon_siso.sqlite`:
   ```bash
   # From the project root:
   mkdir data
   copy "E:\kumon_siso_migration_2026-...\database.sqlite" ".\data\kumon_siso.sqlite"
   ```
4. Start the server:
   ```bash
   npm run start:server
   ```
5. All students, QR tokens, attendance history, and settings will be intact.

---

## Project Structure

```
kumonSISO/
├── package.json                  # Monorepo root
├── tsconfig.json
├── sample_roster.csv             # Example CSV for testing imports
├── Start-KumonSISO-Windows.cmd   # Zero-terminal Windows launcher
├── Start-KumonSISO-Windows.vbs   # Silent Windows launcher (no console)
├── Start-KumonSISO-Mac.command   # Zero-terminal macOS launcher
│
├── packages/
│   ├── shared/                   # Types, constants, phone utils, crypto
│   ├── database/                 # SQLite schema, DAOs, ConfigDao, backup
│   ├── import/                   # CSV parser & column mapper
│   ├── qr/                      # QR generator & PDF card layout
│   ├── sms-adapters/             # WebPush, DevOutbox & Twilio SMS adapters
│   └── sync/                    # Offline event sync engine
│
├── apps/
│   ├── local-server/             # Fastify REST API + SQLite + TunnelManager
│   ├── check-in-pwa/             # Tablet check-in PWA (Vite + TS)
│   ├── desktop-admin/            # Admin GUI (Vite + React)
│   └── optional-parent-relay/    # Parent ack PWA + Service Worker
│
├── tests/
│   └── acceptance.test.ts        # 10-scenario integration test suite
│
└── docs/
    ├── OPERATOR_GUIDE.md         # Non-technical user manual
    ├── DEVELOPER_GUIDE.md        # Architecture & dev reference
    ├── TROUBLESHOOTING_GUIDE.md
    └── SECURITY_PRIVACY.md       # Data minimization & privacy spec
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run build` | Build all packages and apps |
| `npm test` | Run the automated acceptance test suite (10 scenarios) |
| `npm run start:server` | Start the Fastify local server (port 3000) |
| `npm run dev:server` | Start server in watch mode |
| `npm run dev:pwa` | Start the check-in PWA dev server (port 5173) |
| `npm run dev:admin` | Start the desktop admin dev server (port 5174) |

---

## Desktop Admin Panels

| Tab | Description |
|---|---|
| **Dashboard** | Live check-in count, server health, and system status |
| **Student Roster** | Add, edit, delete students; import CSV rosters |
| **QR Cards** | Generate and print 8-per-page PDF QR cards |
| **Attendance History** | Search, filter, and export 2-year attendance records |
| **Check-in Tablets & Devices** | Pair tablets, view connection status, display local IP |
| **Network & Notifications** | Cloudflare Tunnel toggle, PWA Web Push config, VAPID keys |
| **Backup & Computer Move** | Create backups, export transfer packages, restore from USB |
| **Logs** | View server event logs and SMS/notification history |
| **Onboarding Wizard** | First-time setup: center name, phone, timezone, staff PIN |
| **Documentation** | In-app links to operator guide and troubleshooting |

---

## Security & Privacy

- **No cloud, no telemetry.** All data stays on your local computer.
- **No student PII in QR codes.** QR codes contain only cryptographically random tokens.
- **Phone numbers are masked** in all UI screens, logs, and exports (`••• ••• 4567`).
- **Parent link tokens are SHA-256 hashed** in the database — raw tokens are never stored.
- **Staff PIN is hashed** with SHA-256 and never stored in plain text.
- **Admin routes blocked over public tunnel.** When Cloudflare Quick Tunnel is active, only parent-facing endpoints are exposed; admin/config routes return `403 Forbidden`.

See [SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md) for the full specification.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Tablet shows "Offline Mode" | Verify tablet and main computer are on the same Wi-Fi network. Check-ins still record locally. |
| `npm install` fails | Make sure you have Node.js v18+ installed. Run `node --version` to check. |
| Port 3000 already in use | Set a custom port: `PORT=3001 npm run start:server` |
| Browser opens to "Connection Refused" | The launcher now auto-waits, but if the server is slow, refresh the page after a few seconds. |
| Parent push notifications not arriving | Ensure the parent has installed the PWA ("Add to Home Screen") and granted notification permission. Verify VAPID keys are configured in Desktop Admin → Network & Notifications. |
| Cloudflare Tunnel not connecting | Ensure `cloudflared` is installed and accessible in PATH. The tunnel requires an internet connection on the center's computer. |

See [TROUBLESHOOTING_GUIDE.md](docs/TROUBLESHOOTING_GUIDE.md) for more.

---

## License

Private — intended for internal educational center use.
