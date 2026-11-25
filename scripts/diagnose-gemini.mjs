// Diagnose why ClearBreath's Gemini requests fail.
//
// Usage (from the project folder):
//   npx tsx scripts/diagnose-gemini.mjs                  -> tests GEMINI_MODEL from .env
//   npx tsx scripts/diagnose-gemini.mjs gemini-3.6-flash gemini-flash-lite-latest
//
// It builds the exact plan request the app sends (Delhi preset, fixed sample air data) and sends it
// in 4 variants per model, so we can see whether the problem is Google's capacity or our request.
// Uses 4 requests per model from your quota. Never prints your API key.

import fs from 'node:fs';
import { createPlanService } from '../src/server/services/planService.ts';
import { HOUSEHOLD_PRESETS } from '../src/domain/data/presets.ts';
import { validatePlan } from '../src/server/ai/grounding.ts';
import { thinkingConfigFor } from '../src/server/ai/geminiClient.ts';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
if (!apiKey) {
  console.error('GEMINI_API_KEY is missing from .env');
  process.exit(1);
}
const models = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [process.env.GEMINI_MODEL || 'gemini-3.6-flash'];
const TIMEOUT_MS = Number(process.env.DIAG_TIMEOUT_MS || 90_000);

// ---- 1. Build the app's real request with fixed, realistic sample air data (no live APIs) ----
const now = new Date();
const hourIso = (offsetHours) => new Date(now.getTime() + offsetHours * 3600e3).toISOString();
const sampleAir = {
  location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
  measured: {
    source: { name: 'OpenAQ', provider: 'CPCB', url: 'https://openaq.org', kind: 'measured', fetchedAtUtc: now.toISOString() },
    station: { id: 1, name: 'Sample station', distanceKm: 3.2, isMonitor: true },
    latest: {
      pm25: { value: 180, unit: 'µg/m³', atUtc: now.toISOString() },
      pm10: { value: 320, unit: 'µg/m³', atUtc: now.toISOString() },
    },
    series24h: {
      pm25: Array.from({ length: 24 }, (_, i) => ({ timeUtc: hourIso(i - 23), value: 150 + i })),
      pm10: [],
    },
    freshness: 'fresh',
  },
  naqi: null,
  forecast: {
    source: { name: 'Open-Meteo', url: 'https://open-meteo.com', kind: 'forecast', fetchedAtUtc: now.toISOString() },
    points: Array.from({ length: 48 }, (_, i) => ({ timeUtc: hourIso(i + 1), pm25: 120 + 60 * Math.sin(i / 4), pm10: 250 })),
  },
  warnings: [],
  fetchedAtUtc: now.toISOString(),
};

let captured = null;
const captureClient = {
  generateJson: (args) => {
    captured ??= args;
    return Promise.reject(new Error('captured'));
  },
};
process.env.VITEST = 'true'; // silence the app's own log lines while we build the request
const service = createPlanService({ airService: { getAirReport: () => Promise.resolve(sampleAir) }, ai: captureClient });
const preset = HOUSEHOLD_PRESETS[0];
const built = await service.createPlan({ profile: preset, location: { cityId: preset.cityId }, language: 'en' });
delete process.env.VITEST;
if (!captured) {
  console.error('Could not build the request.');
  process.exit(1);
}
const promptChars = captured.system.length + captured.user.length + JSON.stringify(captured.schema).length;
console.log(`Request built for "${preset.title}": about ${Math.round(promptChars / 4)} prompt tokens, ${built.facts.length} facts.\n`);

// ---- 2. Send it in four variants ----
const variants = [
  { label: 'app request', schema: true, thinking: true, json: true },
  { label: 'no JSON schema', schema: false, thinking: true, json: true },
  { label: 'no thinking setting', schema: true, thinking: false, json: true },
  { label: 'plain text', schema: false, thinking: false, json: false },
];

const oneLine = (text, max) => text.replace(/\s+/g, ' ').slice(0, max);

for (const model of models) {
  for (const v of variants) {
    const generationConfig = { temperature: 0.3, maxOutputTokens: 4096 };
    if (v.json) generationConfig.responseMimeType = 'application/json';
    if (v.schema) generationConfig.responseJsonSchema = captured.schema;
    const thinking = thinkingConfigFor(model);
    if (v.thinking && thinking) generationConfig.thinkingConfig = thinking;

    const body = {
      systemInstruction: { parts: [{ text: captured.system }] },
      contents: [{ role: 'user', parts: [{ text: captured.user }] }],
      generationConfig,
    };
    const tag = `${model} | ${v.label.padEnd(19)}`;
    const startedAt = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await res.text();
      const ms = Date.now() - startedAt;
      if (!res.ok) {
        console.log(`${tag} | HTTP ${res.status} after ${ms} ms\n    ${oneLine(text, 400)}`);
      } else {
        const data = JSON.parse(text);
        const candidate = data.candidates?.[0];
        const output = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
        const usage = data.usageMetadata ?? {};
        console.log(
          `${tag} | OK after ${ms} ms | finish=${candidate?.finishReason} | tokens: ` +
            `prompt ${usage.promptTokenCount ?? '?'}, thinking ${usage.thoughtsTokenCount ?? 0}, answer ${usage.candidatesTokenCount ?? '?'}`,
        );
        if (v.schema) {
          const check = validatePlan(output, built.facts, built.candidates);
          console.log(check.ok ? '    passes ClearBreath validation' : `    FAILS validation: ${oneLine(check.errors.slice(0, 2).join(' | '), 300)}`);
        } else {
          console.log(`    ${oneLine(output, 160)}…`);
        }
      }
    } catch (err) {
      console.log(`${tag} | ${err.name} after ${Date.now() - startedAt} ms: ${oneLine(String(err.message), 200)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000)); // be gentle with the quota
  }
}
