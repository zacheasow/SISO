# Kumon SISO — Student Check-In & Pickup System

A **local-first**, standalone student attendance, drop-off acknowledgment, parent pickup, and checkout application. Runs entirely on your center's own computer with zero cloud dependencies, zero distributor licensing, and zero external tracking.

---

## Features

| Feature | Description |
|---|---|
| **QR Check-In** | Students scan a printed QR card on a tablet to check in instantly |
| **Offline-First** | Check-ins record locally on the tablet even when Wi-Fi drops — syncs automatically when reconnected |
| **Parent SMS Alerts** | Parents receive a text with a secure link to acknowledge drop-off and request pickup |
| **Staff Checkout** | Students are only physically released when staff taps "Complete Checkout" — parent request alone does **not** release the student |
| **Override System** | Staff can override any workflow step with a shared PIN + mandatory written reason |
| **CSV Roster Import** | Import student rosters from any spreadsheet export with flexible column auto-detection |
| **Printable QR Cards** | Generate 8-card-per-page PDF sheets with center logo, student name, and secure QR code |
| **2-Year History** | Full attendance audit trail with duration calculations, drop-off/pickup status, and CSV export |
| **Backup & Transfer** | Move your entire installation to a new computer via USB — no distributor needed |
| **Device Pairing** | Pair multiple tablets to one main computer over local Wi-Fi |

---

## Prerequisites

- **Node.js** v18 or later — [Download here](https://nodejs.org/)
- **npm** v9+ (included with Node.js)
- A modern web browser (Chrome, Edge, Firefox)

That's it. No database servers, no Docker, no cloud accounts.

---

## Quick Start (Same Computer)

```bash
# 1. Clone or copy the project
git clone <your-repo-url> kumonSISO
cd kumonSISO

# 2. Install all dependencies
npm install

# 3. Build all packages
npm run build

# 4. Start the local server (runs on port 3000)
npm run start:server
```

Then open **http://localhost:3000** in your browser. The server creates its SQLite database automatically on first run at `./data/kumon_siso.sqlite`.

### Running the Desktop Admin GUI (development mode)

```bash
npm run dev:admin
# Opens on http://localhost:5174
```

### Running the Tablet Check-In PWA (development mode)

```bash
npm run dev:pwa
# Opens on http://localhost:5173
```

---

## Setting Up on Another Computer

### Option A — Fresh Install (Recommended for New Centers)

1. **Copy the project folder** to the new computer via USB, network share, or Git.

2. **Install Node.js** on the new computer if not already installed.

3. **Open a terminal** in the project directory and run:
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

## Connecting Tablets Over Wi-Fi

1. Start the local server on the **main computer** (`npm run start:server`).

2. Find the main computer's local IP address:
   ```bash
   # Windows
   ipconfig
   # Look for "IPv4 Address" under your Wi-Fi adapter, e.g. 192.168.1.42
   ```

3. On the **tablet's browser**, navigate to:
   ```
   http://192.168.1.42:5173
   ```
   (Replace with your actual IP.)

4. The tablet PWA will connect to the local server automatically. If the main computer is temporarily unreachable, check-ins continue recording locally on the tablet and sync when reconnected.

> **Tip:** Bookmark the URL on the tablet and use "Add to Home Screen" for a native app experience.

---

## Project Structure

```
kumonSISO/
├── package.json              # Monorepo root
├── tsconfig.json
├── sample_roster.csv         # Example CSV for testing imports
│
├── packages/
│   ├── shared/               # Types, constants, phone utils, crypto
│   ├── database/             # SQLite schema, DAOs, backup service
│   ├── import/               # CSV parser & column mapper
│   ├── qr/                   # QR generator & PDF card layout
│   ├── sms-adapters/         # Twilio & dev outbox SMS adapters
│   └── sync/                 # Offline event sync engine
│
├── apps/
│   ├── local-server/         # Fastify REST API + SQLite backend
│   ├── check-in-pwa/         # Tablet check-in PWA (Vite + TS)
│   ├── desktop-admin/        # Admin GUI (Vite + React)
│   └── optional-parent-relay/# Parent ack landing page server
│
├── tests/
│   └── acceptance.test.ts    # 8-scenario integration test suite
│
└── docs/
    ├── OPERATOR_GUIDE.md     # Non-technical user manual
    ├── DEVELOPER_GUIDE.md    # Architecture & dev reference
    ├── TROUBLESHOOTING_GUIDE.md
    └── SECURITY_PRIVACY.md   # Data minimization & privacy spec
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run build` | Build all packages and apps |
| `npm test` | Run the automated acceptance test suite |
| `npm run start:server` | Start the Fastify local server (port 3000) |
| `npm run dev:server` | Start server in watch mode |
| `npm run dev:pwa` | Start the check-in PWA dev server (port 5173) |
| `npm run dev:admin` | Start the desktop admin dev server (port 5174) |

---

## SMS Configuration (Optional)

By default, SMS messages are written to a local `sms_outbox/` folder as JSON files for development. To send real texts:

1. Create a [Twilio](https://www.twilio.com/) account and get your Account SID, Auth Token, and a phone number.
2. Configure credentials through the Desktop Admin → **SMS Log & Provider Settings** (coming in a future update), or update the SMS adapter initialization in `apps/local-server/src/server.ts`.

---

## Security & Privacy

- **No cloud, no telemetry.** All data stays on your local computer.
- **No student PII in QR codes.** QR codes contain only cryptographically random tokens.
- **Phone numbers are masked** in all UI screens, logs, and exports (`••• ••• 4567`).
- **Parent link tokens are SHA-256 hashed** in the database — raw tokens are never stored.
- **Staff PIN is hashed** with SHA-256 and never stored in plain text.

See [SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md) for the full specification.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Tablet shows "Offline Mode" | Verify tablet and main computer are on the same Wi-Fi network. Check-ins still record locally. |
| `npm install` fails | Make sure you have Node.js v18+ installed. Run `node --version` to check. |
| Port 3000 already in use | Set a custom port: `PORT=3001 npm run start:server` |
| Parent SMS link doesn't work | SMS links require the optional parent relay server or a public tunnel (e.g. Cloudflare Tunnel). Staff PIN overrides work without SMS. |

See [TROUBLESHOOTING_GUIDE.md](docs/TROUBLESHOOTING_GUIDE.md) for more.

---

## License

Private — intended for internal educational center use.
