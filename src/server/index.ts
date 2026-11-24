import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { TypedCache } from './cache.js';
import { createOpenAqAdapter } from './adapters/openaq.js';
import { createGoogleAqAdapter } from './adapters/googleAirQuality.js';
import { createOpenMeteoAdapter } from './adapters/openMeteo.js';
import { createAirService } from './services/airService.js';
import { createGeminiClient } from './ai/geminiClient.js';
import { createPlanService } from './services/planService.js';
import type { AirReport } from '../shared/schemas.js';

const config = loadConfig();

// Build adapters from config
const openaq = createOpenAqAdapter({ apiKey: config.openaqApiKey ?? '' });
const google =
  config.googleMapsApiKey && config.googleMapsApiKey.trim()
    ? createGoogleAqAdapter({ apiKey: config.googleMapsApiKey })
    : undefined;
const openMeteo = createOpenMeteoAdapter();

const airCache = new TypedCache<AirReport>(200);

const airService = createAirService({
  openaq,
  google,
  openMeteo,
  cache: airCache,
  clock: () => new Date().toISOString(),
});

const aiClient = createGeminiClient(config.geminiApiKey ?? '', config.geminiModel);
const planService = createPlanService({
  airService,
  ai: aiClient,
  config: { geminiModel: config.geminiModel, grapStage: config.grapStage },
  clock: () => new Date().toISOString(),
});

const app = createApp({ config, airService, planService });

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
