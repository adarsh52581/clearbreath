import fs from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  APP_VERSION: z.string().default('dev'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  GEMINI_FALLBACK_MODEL: z.string().optional(),
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
  /** Optional backup models (comma-separated in GEMINI_FALLBACK_MODEL), tried in order. */
  geminiFallbackModels?: string[];
  openaqApiKey?: string;
  googleMapsApiKey?: string;
  forecastProvider: 'google' | 'openmeteo';
  grapStage?: string;
  grapAsOf?: string;
  grapSourceUrl?: string;
};

// ClearBreath needs JSON text back, so speech (-tts) and image (-image) models cannot work.
const NON_TEXT_MODEL = /-(tts|image)(-|$)/i;

function parseModelList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

function validateModelIds(env: z.infer<typeof envSchema>): void {
  const ids: [string, string][] = [
    ['GEMINI_MODEL', env.GEMINI_MODEL],
    ...parseModelList(env.GEMINI_FALLBACK_MODEL).map((id): [string, string] => ['GEMINI_FALLBACK_MODEL', id]),
  ];
  for (const [name, id] of ids) {
    if (NON_TEXT_MODEL.test(id.trim())) {
      throw new Error(
        `${name}=${id.trim()} is a speech or image model. Use a text model, e.g. one ending in -flash or -flash-lite.`,
      );
    }
  }
}

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
  validateModelIds(env);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    appVersion: env.APP_VERSION,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
    geminiFallbackModels: parseModelList(env.GEMINI_FALLBACK_MODEL),
    openaqApiKey: env.OPENAQ_API_KEY,
    googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
    forecastProvider: env.FORECAST_PROVIDER,
    grapStage: env.GRAP_STAGE,
    grapAsOf: env.GRAP_AS_OF,
    grapSourceUrl: env.GRAP_SOURCE_URL,
  };
}
