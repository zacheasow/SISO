import { spawn, ChildProcess } from 'node:child_process';
import { ConfigDao } from '@kumon-siso/database';

export class TunnelManager {
  private process: ChildProcess | null = null;
  private currentUrl: string | null = null;
  private isStarting = false;

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

  async start(): Promise<string | null> {
    if (this.process || this.isStarting) {
      return this.currentUrl;
    }
    this.isStarting = true;

    return new Promise((resolve) => {
      try {
        // Spawn cloudflared quick tunnel
        // Uses system cloudflared binary or npx fallback
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'cmd.exe' : 'cloudflared';
        const args = isWin
          ? ['/c', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${this.localPort}`]
          : ['tunnel', '--url', `http://127.0.0.1:${this.localPort}`];

        this.process = spawn(cmd, args, {
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
        let resolved = false;

        const parseLine = async (line: string) => {
          const match = line.match(urlRegex);
          if (match && !resolved) {
            resolved = true;
            this.currentUrl = match[0];
            this.isStarting = false;
            await this.configDao.setValue('cloudflare_tunnel_url', this.currentUrl);
            await this.configDao.setValue('cloudflare_tunnel_enabled', '1');
            console.log(`[Cloudflare Tunnel Active] Public URL: ${this.currentUrl}`);
            resolve(this.currentUrl);
          }
        };

        this.process.stdout?.on('data', (data) => {
          const str = data.toString();
          parseLine(str);
        });

        this.process.stderr?.on('data', (data) => {
          const str = data.toString();
          parseLine(str);
        });

        this.process.on('error', (err) => {
          console.warn('[TunnelManager] Failed to spawn cloudflared binary:', err.message);
          this.isStarting = false;
          if (!resolved) resolve(null);
        });

        this.process.on('exit', () => {
          this.process = null;
          this.currentUrl = null;
          this.isStarting = false;
          if (!resolved) resolve(null);
        });

        // Timeout fallback after 8 seconds if cloudflared binary not installed
        setTimeout(() => {
          if (!resolved) {
            this.isStarting = false;
            resolve(this.currentUrl);
          }
        }, 8000);
      } catch (err) {
        console.warn('[TunnelManager] Quick tunnel startup error:', err);
        this.isStarting = false;
        resolve(null);
      }
    });
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
