import Fastify from 'fastify';

export async function createRelayServer(localServerApiBase = 'http://localhost:3000') {
  const fastify = Fastify({ logger: true });

  // Serve Service Worker for Web Push
  fastify.get('/sw.js', async (request, reply) => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const swPath = path.join(process.cwd(), 'apps/optional-parent-relay/src/public/sw.js');
    if (fs.existsSync(swPath)) {
      reply.type('application/javascript');
      return reply.send(fs.readFileSync(swPath, 'utf8'));
    }
    reply.type('application/javascript');
    return reply.send('self.addEventListener("push", () => {});');
  });

  // Parent Acknowledgment HTML Landing Page
  fastify.get('/parent/ack/:token', async (request, reply) => {
    const { token }: any = request.params;
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Student Drop-off & Pickup Acknowledgment</title>
      <link rel="manifest" href="data:application/json,{ %22name%22:%22Kumon%20SISO%22,%22short_name%22:%22Kumon%20SISO%22,%22display%22:%22standalone%22,%22start_url%22:%22/%22 }">
      <style>
        body { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 1.5rem; }
        .card { background: #fff; border-radius: 12px; padding: 2rem; max-width: 480px; margin: 2rem auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; }
        h1 { font-size: 1.5rem; color: #1e40af; margin-bottom: 0.5rem; }
        p { color: #475569; margin-bottom: 1.5rem; line-height: 1.5; }
        .btn { display: block; width: 100%; font-size: 1.1rem; font-weight: bold; padding: 1rem; border-radius: 8px; border: none; cursor: pointer; margin-bottom: 1rem; }
        .btn-dropoff { background: #16a34a; color: #fff; }
        .btn-pickup { background: #1e40af; color: #fff; }
        .status-msg { margin-top: 1rem; padding: 0.75rem; border-radius: 6px; display: none; }
        .success { background: #dcfce7; color: #15803d; }
        .pwa-banner { background: #e0e7ff; color: #3730a3; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1rem; text-align: left; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Community Learning Center</h1>
        <p>Parent Acknowledgment & Student Safety Portal</p>

        <div id="pwa-banner" class="pwa-banner" style="display:none;">
          💡 <strong>Enable Lock-screen Push Notifications:</strong> Tap <strong>Share → Add to Home Screen</strong> on iPhone to receive lock-screen alerts!
        </div>

        <p>I acknowledge that this student was dropped off & checked into the center, or request physical pickup release below.</p>

        <button id="btn-dropoff" class="btn btn-dropoff">Acknowledge Drop-off</button>
        <button id="btn-pickup" class="btn btn-pickup">I am picking up this student</button>

        <div id="status" class="status-msg"></div>
      </div>

      <script>
        const token = "${token}";
        const apiBase = "${localServerApiBase}";
        const statusDiv = document.getElementById('status');

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js').then(() => {
            console.log('Push Service Worker registered');
          }).catch(console.error);
        }

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS && !window.navigator.standalone) {
          document.getElementById('pwa-banner').style.display = 'block';
        }

        document.getElementById('btn-dropoff').onclick = async () => {
          try {
            const res = await fetch(apiBase + '/api/parent/ack-dropoff', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: token, maskedPhone: 'Parent Web Link' })
            });
            const data = await res.json();
            statusDiv.className = 'status-msg success';
            statusDiv.style.display = 'block';
            statusDiv.textContent = data.message || 'Drop-off acknowledged successfully!';
          } catch(err) {
            alert('Failed to send drop-off acknowledgment');
          }
        };

        document.getElementById('btn-pickup').onclick = async () => {
          try {
            const res = await fetch(apiBase + '/api/parent/request-pickup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: token, maskedPhone: 'Parent Web Link' })
            });
            const data = await res.json();
            statusDiv.className = 'status-msg success';
            statusDiv.style.display = 'block';
            statusDiv.textContent = data.message || 'Pickup request sent to staff!';
          } catch(err) {
            alert('Failed to send pickup request');
          }
        };
      </script>
    </body>
    </html>
    `;
    reply.type('text/html');
    return reply.send(html);
  });

  return fastify;
}
