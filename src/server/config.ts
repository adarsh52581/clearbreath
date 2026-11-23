import fs from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  APP_VERSION: z.string().default('dev'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  OPENAQ_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  FORECAST_PROVIDER: z.enum(['google', 'openmeteo']).default('google'),
  GRAP_STAGE: z.string().optional(),
  GRAP_AS_OF: z.string().optional(),
  GRAP_SOURCE_URL: z.string().optional(),
});

export type Config = {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  appVersion: string;
  geminiApiKey?: string;
  geminiModel: string;
  openaqApiKey?: string;
  googleMapsApiKey?: string;
  forecastProvider: 'google' | 'openmeteo';
  grapStage?: string;
  grapAsOf?: string;
  grapSourceUrl?: string;
};

function validateProductionEnv(env: z.infer<typeof envSchema>): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }
  const missing: string[] = [];
  if (!env.GEMINI_API_KEY?.trim()) {
    missing.push('GEMINI_API_KEY');
  }
  if (!env.OPENAQ_API_KEY?.trim()) {
    missing.push('OPENAQ_API_KEY');
  }
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

export function loadConfig(rawEnv: Record<string, string | undefined> = process.env): Config {
  const isDev = (rawEnv.NODE_ENV ?? 'development') === 'development';
  if (isDev && fs.existsSync('.env')) {
    try {
      process.loadEnvFile('.env');
    } catch {
      // Continue if .env cannot be loaded
    }
  }

  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    throw new Error('Invalid environment configuration');
  }

  const env = parsed.data;
  validateProductionEnv(env);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    appVersion: env.APP_VERSION,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
    openaqApiKey: env.OPENAQ_API_KEY,
    googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
    forecastProvider: env.FORECAST_PROVIDER,
    grapStage: env.GRAP_STAGE,
    grapAsOf: env.GRAP_AS_OF,
    grapSourceUrl: env.GRAP_SOURCE_URL,
  };
}
