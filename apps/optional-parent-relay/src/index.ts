import { createRelayServer } from './server.js';

async function start() {
  const PORT = Number(process.env.RELAY_PORT) || 3001;
  const server = await createRelayServer();

  try {
    const address = await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Kumon SISO Parent Ack Relay] Running on ${address}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
