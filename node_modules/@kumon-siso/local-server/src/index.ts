import { createServer } from './server.js';

async function start() {
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  const { fastify } = await createServer();

  try {
    const address = await fastify.listen({ port: PORT, host: HOST });
    console.log(`[Kumon SISO Local Server] Running on ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
