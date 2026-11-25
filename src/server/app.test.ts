import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import type { Config } from './config.js';

interface HealthResponse {
  status: string;
  version: string;
  time: string;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

const testConfig: Config = {
  nodeEnv: 'test',
  port: 8080,
  appVersion: 'test-v1',
  geminiModel: 'gemini-3.6-flash',
  forecastProvider: 'google',
};

describe('app', () => {
  it('GET /api/health returns 200 and JSON shape', async () => {
    const app = createApp({ config: testConfig });
    const response = await request(app).get('/api/health');

    const body = response.body as HealthResponse;
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(body.status).toBe('ok');
    expect(body.version).toBe('test-v1');
    expect(typeof body.time).toBe('string');
    expect(new Date(body.time).toString()).not.toBe('Invalid Date');
  });

  it('unknown /api route returns 404 JSON', async () => {
    const app = createApp({ config: testConfig });
    const response = await request(app).get('/api/unknown-endpoint');

    const body = response.body as ErrorResponse;
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('/api/unknown-endpoint');
  });

  it('sets security headers and removes x-powered-by', async () => {
    const app = createApp({ config: testConfig });
    const response = await request(app).get('/api/health');

    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns 413 JSON when request body exceeds 256kb', async () => {
    const app = createApp({ config: testConfig });
    const largeData = 'x'.repeat(300 * 1024);
    const response = await request(app)
      .post('/api/unknown-endpoint')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: largeData }));

    const body = response.body as ErrorResponse;
    expect(response.status).toBe(413);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(typeof body.error.message).toBe('string');
  });

  it('serves SPA fallback in production mode with no-cache header', async () => {
    const prodConfig: Config = {
      ...testConfig,
      nodeEnv: 'production',
      geminiApiKey: 'test',
      openaqApiKey: 'test',
    };
    const webDistPath = path.resolve(process.cwd(), 'dist/web');
    const indexPath = path.join(webDistPath, 'index.html');
    const createdTempFile = !fs.existsSync(indexPath);
    if (createdTempFile) {
      fs.mkdirSync(webDistPath, { recursive: true });
      fs.writeFileSync(indexPath, '<!DOCTYPE html><html><body>ClearBreath</body></html>');
    }

    try {
      const app = createApp({ config: prodConfig });
      const response = await request(app).get('/some-page');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.text).toContain('ClearBreath');
    } finally {
      if (createdTempFile) {
        fs.unlinkSync(indexPath);
      }
    }
  });

  it('redirects GET / to the Vite dev server in development', async () => {
    const app = createApp({ config: { ...testConfig, nodeEnv: 'development' } });
    const response = await request(app).get('/');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('http://localhost:5173/');
  });

  it('does not redirect GET / outside development', async () => {
    const app = createApp({ config: testConfig });
    const response = await request(app).get('/');

    expect(response.status).not.toBe(302);
  });
});
