import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const app = createApp({ config });

const server = app.listen(config.port, () => {
  const logEntry = JSON.stringify({
    level: 'info',
    message: 'ClearBreath server started',
    port: config.port,
    env: config.nodeEnv,
    version: config.appVersion,
  });
  process.stdout.write(`${logEntry}\n`);
});

function handleShutdown(signal: string): void {
  const logEntry = JSON.stringify({
    level: 'info',
    message: `Received ${signal}, shutting down gracefully`,
  });
  process.stdout.write(`${logEntry}\n`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
