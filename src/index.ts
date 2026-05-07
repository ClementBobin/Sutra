import { buildApp } from './app.js';
import { config } from './config.js';

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
  } catch (error: unknown) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
