import { spawn, spawnSync, execSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigDao } from '@kumon-siso/database';
import { DEFAULT_PORTAL_BASE_URL } from '@kumon-siso/shared';

/**
 * Tunnel configuration loaded from an optional `.env` file. When a custom
 * domain is configured (TUNNEL_DOMAIN / TUNNEL_NAME), the tunnel runs against
 * that hostname. Otherwise a dynamic Cloudflare Quick Tunnel is spawned.
 */
export interface TunnelEnvConfig {
  tunnelDomain?: string;
  tunnelName?: string;
  tunnelConfigPath?: string;
  tunnelToken?: string;
}

function parseEnvFile(filePath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
        value = value.slice(1, -1);
      }
      vars[trimmed.slice(0, eq).trim()] = value;
    }
  } catch {
    // ignore unreadable env file
  }
  return vars;
}

function loadTunnelEnvConfig(): TunnelEnvConfig {
  const candidates = [
    process.env.TUNNEL_ENV_FILE || '',
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '.env'),
  ].filter(Boolean);

  const envPath = candidates.find((p) => fs.existsSync(p));
  if (!envPath) return {};

  const vars = parseEnvFile(envPath);
  const tunnelDomain = vars.TUNNEL_DOMAIN || vars.CLOUDFLARED_HOSTNAME;
  const tunnelName = vars.TUNNEL_NAME;
  const tunnelConfigPath = vars.TUNNEL_CONFIG || vars.CLOUDFLARED_CONFIG;
  const tunnelToken = vars.CLOUDFLARE_TUNNEL_TOKEN || vars.TUNNEL_TOKEN;

  if (tunnelToken) {
    console.log(`[TunnelManager] Persistent tunnel token found via ${envPath}`);
    return { tunnelToken };
  }

  if (!tunnelDomain && !tunnelName) {
    console.warn(`[TunnelManager] Found ${envPath} but no TUNNEL_DOMAIN/TUNNEL_NAME keys. Falling back to Quick Tunnel.`);
    return {};
  }

  console.log(`[TunnelManager] Custom domain tunnel configured via ${envPath}`);
  return { tunnelDomain, tunnelName, tunnelConfigPath };
}

export class TunnelManager {
  private process: ChildProcess | null = null;
  private currentUrl: string | null = null;
  private isStarting = false;
  private startPromise: Promise<string | null> | null = null;

  constructor(private configDao: ConfigDao, private localPort = 3000) {
    // Ensure clean process cleanup on node process exit / crash
    const cleanup = () => this.stop();
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  /**
   * Register the active (possibly temporary) tunnel URL with the relay(s) so
   * the branded /{centerSlug}/... URLs keep resolving even when the Quick
   * Tunnel URL changes on every restart. Registers with BOTH the optional
   * Cloudflare Worker relay and the Vercel-hosted portal PWA (whose
   * /api/target resolves the current backend for the parent/kiosk apps).
   */
  async registerWithRelay(tunnelUrl: string): Promise<void> {
    try {
      const [relayWorkerUrl, centerSlug, relaySecret, portalBaseUrl] = await Promise.all([
        this.configDao.getValue('relay_worker_url', ''),
        this.configDao.getValue('center_slug', ''),
        this.configDao.getValue('relay_secret', ''),
        this.configDao.getValue('portal_base_url', DEFAULT_PORTAL_BASE_URL),
      ]);
      if (!centerSlug) {
        console.warn('[TunnelManager] Relay handshake skipped — center_slug not configured.');
        return;
      }

      const endpoints = new Set<string>();
      if (relayWorkerUrl) {
        endpoints.add(`${relayWorkerUrl.replace(/\/+$/, '')}/api/register`);
      }
      if (portalBaseUrl) {
        endpoints.add(`${portalBaseUrl.replace(/\/+$/, '')}/api/register`);
      }
      if (endpoints.size === 0) {
        console.warn('[TunnelManager] Relay handshake skipped — no relay_worker_url / portal_base_url configured.');
        return;
      }

      for (const endpoint of endpoints) {
        console.log(`[TunnelManager] Registering "${centerSlug}" -> ${tunnelUrl} with ${endpoint}`);
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(relaySecret ? { 'X-Relay-Secret': relaySecret } : {}),
            },
            body: JSON.stringify({ centerSlug, targetUrl: tunnelUrl, secret: relaySecret }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!res.ok) {
            console.warn(`[TunnelManager] Relay registration (${endpoint}) returned ${res.status}: ${await res.text().catch(() => '')}`);
            continue;
          }
          const body = await res.json().catch(() => ({}));
          console.log(`[TunnelManager] Relay registered with ${endpoint}: ${body.relayUrl || 'ok'}`);
        } catch (err: any) {
          console.warn(`[TunnelManager] Relay handshake error for ${endpoint}:`, err?.message || err);
        }
      }
    } catch (err: any) {
      console.warn('[TunnelManager] Relay handshake error:', err?.message || err);
    }
  }

  get isActive(): boolean {
    return !!this.process;
  }

  /**
   * Kill any orphaned cloudflared processes left over from a previous
   * unclean shutdown. This prevents "address already in use" errors when
   * the app restarts.
   */
  private killStaleProcesses(): void {
    try {
      if (process.platform === 'win32') {
        // tasklist + taskkill for Windows
        const result = spawnSync('tasklist', ['/FI', 'IMAGENAME eq cloudflared.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf-8', timeout: 5000 });
        if (result.status === 0 && result.stdout.includes('cloudflared')) {
          console.log('[TunnelManager] Killing stale cloudflared processes...');
          spawnSync('taskkill', ['/F', '/IM', 'cloudflared.exe'], { encoding: 'utf-8', timeout: 5000 });
        }
      } else {
        // pkill for Linux/macOS
        spawnSync('pkill', ['-f', 'cloudflared'], { timeout: 5000 });
      }
    } catch {
      // best-effort — stale process kill is non-critical
    }
  }

  /**
   * Ensures an active tunnel. If a tunnel is already running its URL is
   * returned immediately; otherwise a new tunnel is started. Called on server
   * boot to manage/verify the tunnel.
   */
  async ensureActive(): Promise<string | null> {
    if (this.process && this.currentUrl) return this.currentUrl;
    if (this.startPromise) return this.startPromise;

    // Kill any orphaned cloudflared from a previous crash/restart
    this.killStaleProcesses();

    this.startPromise = this.start();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async start(): Promise<string | null> {
    if (this.process || this.isStarting) {
      return this.currentUrl;
    }
    this.isStarting = true;

    const envConfig = loadTunnelEnvConfig();

    // Check for token from config DB (set via UI) as well as .env
    let tunnelToken = envConfig.tunnelToken || process.env.CLOUDFLARE_TUNNEL_TOKEN || '';
    if (!tunnelToken) {
      try {
        tunnelToken = await this.configDao.getValue('cloudflare_tunnel_token', '');
      } catch {
        // configDao may not be available during early init
      }
    }

    // If we have a token, prefer it over everything else (persistent named tunnel)
    if (tunnelToken) {
      envConfig.tunnelToken = tunnelToken;
    }

    const plan = this.buildSpawnPlan(envConfig);

    if (!plan) {
      console.warn('[TunnelManager] No cloudflared binary found. Install cloudflared or ensure npm/npx is available. Quick tunnel disabled.');
      this.isStarting = false;
      return null;
    }

    const mode = tunnelToken ? 'persistent token tunnel' : envConfig.tunnelDomain || envConfig.tunnelName ? 'custom domain' : 'quick tunnel';
    console.log(`[TunnelManager] Starting Cloudflare ${mode}...`);

    return new Promise((resolve) => {
      let settled = false;
      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;
        this.isStarting = false;
        resolve(value);
      };

      const onTunnelUrl = async (url: string) => {
        this.currentUrl = url;
        try {
          await this.configDao.setValue('cloudflare_tunnel_url', url);
          await this.configDao.setValue('cloudflare_tunnel_enabled', '1');
        } catch (e) {
          // config persistence is best-effort
        }
        console.log(`[Cloudflare Tunnel Active] Public URL: ${url}`);
        this.registerWithRelay(url).catch((err) => console.warn('[TunnelManager] Relay registration failed:', err?.message));
        settle(url);
      };

      try {
        this.process = spawn(plan.command, plan.args, {
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (err) {
        console.warn('[TunnelManager] Quick tunnel startup error:', err);
        this.isStarting = false;
        resolve(null);
        return;
      }

      const quickUrlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
      const tokenUrlRegex = /https:\/\/[a-zA-Z0-9-]+\.cfargotunnel\.com|https:\/\/[a-zA-Z0-9.-]+\.tunnel\.cloudflared\.com/;
      const customDomainUrl = envConfig.tunnelDomain ? `https://${envConfig.tunnelDomain}` : null;

      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        if (customDomainUrl) {
          if (/Registered tunnel connection|Connection established|Your quick tunnel has been created/i.test(text)) {
            onTunnelUrl(customDomainUrl);
          }
        } else {
          // Token tunnels expose the URL in logs too
          const match = text.match(quickUrlRegex) || text.match(tokenUrlRegex);
          if (match) {
            onTunnelUrl(match[0]);
          }
          // For token-based tunnels, the URL might appear differently
          if (tunnelToken && !this.currentUrl) {
            const urlMatch = text.match(/https:\/\/[a-zA-Z0-9.-]+\.(?:trycloudflare\.com|cfargotunnel\.com|tunnel\.cloudflared\.com)/);
            if (urlMatch) {
              onTunnelUrl(urlMatch[0]);
            }
          }
        }
      };

      this.process.stdout?.on('data', onData);
      this.process.stderr?.on('data', onData);

      this.process.on('error', (err) => {
        console.warn('[TunnelManager] Failed to spawn cloudflared:', err.message);
        this.process = null;
        settle(null);
      });

      this.process.on('exit', (code) => {
        console.warn(`[TunnelManager] cloudflared exited with code ${code}.`);
        this.process = null;
        this.currentUrl = null;
        settle(null);
      });

      // Give cloudflared up to ~12 seconds to establish a connection before
      // timing out. A late URL (reported after the timeout) is still stored.
      setTimeout(() => {
        settle(this.currentUrl);
      }, 12000);
    });
  }

  private buildSpawnPlan(envConfig: TunnelEnvConfig): { command: string; args: string[] } | null {
    const isWin = process.platform === 'win32';
    const baseArgs: string[] = [];

    if (envConfig.tunnelToken) {
      // Persistent token tunnel: cloudflared tunnel run --token <token>
      baseArgs.push('tunnel', 'run', '--token', envConfig.tunnelToken);
    } else if (envConfig.tunnelName) {
      // Named tunnel (custom domain): cloudflared tunnel [--config <cfg>] run <name>
      baseArgs.push('tunnel');
      if (envConfig.tunnelConfigPath) {
        baseArgs.push('--config', envConfig.tunnelConfigPath);
      }
      baseArgs.push('run', envConfig.tunnelName);
    } else {
      baseArgs.push('tunnel', '--url', `http://127.0.0.1:${this.localPort}`);
      if (envConfig.tunnelDomain) {
        baseArgs.push('--hostname', envConfig.tunnelDomain);
      }
    }

    // 1. Explicit binary path override
    if (process.env.CLOUDFLARED_PATH && fs.existsSync(process.env.CLOUDFLARED_PATH)) {
      return { command: process.env.CLOUDFLARED_PATH, args: baseArgs };
    }

    // 2. cloudflared available on PATH
    const probe = spawnSync(isWin ? 'where' : 'which', ['cloudflared'], { encoding: 'utf-8' });
    if (probe.status === 0 && probe.stdout.trim()) {
      return isWin
        ? { command: 'cmd.exe', args: ['/c', 'cloudflared', ...baseArgs] }
        : { command: 'cloudflared', args: baseArgs };
    }

    // 3. npx fallback (downloads the `cloudflared` npm wrapper, which installs
    //    the binary on first use). Not available inside the packaged sidecar.
    return isWin
      ? { command: 'cmd.exe', args: ['/c', 'npx', '--yes', 'cloudflared', ...baseArgs] }
      : { command: 'npx', args: ['--yes', 'cloudflared', ...baseArgs] };
  }

  stop(): void {
    if (this.process) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(this.process.pid), '/f', '/t']);
        } else {
          this.process.kill('SIGKILL');
        }
      } catch (e) {
        // ignore
      }
      this.process = null;
      this.currentUrl = null;
    }
  }
}
