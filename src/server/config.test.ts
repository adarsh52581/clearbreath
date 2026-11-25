import { describe, it, expect } from 'vitest';
import { loadConfig } from './config.js';

describe('config', () => {
  it('throws in production when keys are missing and error message contains no values', () => {
    const secretValue = 'super_secret_test_value_12345';
    const prodEnv = {
      NODE_ENV: 'production',
      PORT: '8080',
      GEMINI_API_KEY: '',
      OPENAQ_API_KEY: '',
      OTHER_SECRET: secretValue,
    };

    let thrownError: Error | null = null;
    try {
      loadConfig(prodEnv);
    } catch (err) {
      thrownError = err as Error;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toContain('Missing required production environment variables');
    expect(thrownError?.message).toContain('GEMINI_API_KEY');
    expect(thrownError?.message).toContain('OPENAQ_API_KEY');
    expect(thrownError?.message).not.toContain(secretValue);
  });

  it('works in development without keys', () => {
    const devEnv = {
      NODE_ENV: 'development',
      PORT: '3000',
    };

    const config = loadConfig(devEnv);
    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.appVersion).toBe('dev');
    expect(config.geminiApiKey).toBeUndefined();
    expect(config.openaqApiKey).toBeUndefined();
    expect(config.forecastProvider).toBe('google');
  });

  it('validates production successfully when required keys are present', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      PORT: '8080',
      APP_VERSION: 'prod-1.0',
      GEMINI_API_KEY: 'test-gemini-key',
      OPENAQ_API_KEY: 'test-openaq-key',
    };

    const config = loadConfig(prodEnv);
    expect(config.nodeEnv).toBe('production');
    expect(config.geminiApiKey).toBe('test-gemini-key');
    expect(config.openaqApiKey).toBe('test-openaq-key');
  });
  it('reads optional backup models as a comma-separated list', () => {
    expect(loadConfig({ NODE_ENV: 'test', GEMINI_FALLBACK_MODEL: '  backup-model  ' }).geminiFallbackModels).toEqual([
      'backup-model',
    ]);
    expect(
      loadConfig({ NODE_ENV: 'test', GEMINI_FALLBACK_MODEL: 'a-flash, b-flash-lite ,, c-flash' }).geminiFallbackModels,
    ).toEqual(['a-flash', 'b-flash-lite', 'c-flash']);
    expect(loadConfig({ NODE_ENV: 'test', GEMINI_FALLBACK_MODEL: '   ' }).geminiFallbackModels).toEqual([]);
    expect(loadConfig({ NODE_ENV: 'test' }).geminiFallbackModels).toEqual([]);
  });

  it('rejects speech and image model ids with a clear message', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', GEMINI_MODEL: 'gemini-3.8-flash-tts' })).toThrow(/speech or image model/);
    expect(() =>
      loadConfig({ NODE_ENV: 'test', GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite,gemini-3.1-flash-image' }),
    ).toThrow(/GEMINI_FALLBACK_MODEL/);
    expect(loadConfig({ NODE_ENV: 'test', GEMINI_MODEL: 'gemini-3.6-flash' }).geminiModel).toBe('gemini-3.6-flash');
  });
});
