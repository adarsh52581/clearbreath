import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors.js';
import type { GenerateJsonArgs } from './aiClient.js';
import { AI_REQUEST_BUDGET_MS } from './aiClient.js';
import {
  classifyGeminiError,
  createGeminiClient,
  GEMINI_CALL_TIMEOUT_MS,
  modelChain,
  thinkingConfigFor,
  type GenerateFn,
} from './geminiClient.js';

const overloaded = new Error(
  '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}',
);
const quota = new Error('{"error":{"code":429,"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED"}}');
const badRequest = new Error('{"error":{"code":400,"message":"Invalid argument","status":"INVALID_ARGUMENT"}}');
const notFound = new Error(
  '{"error":{"code":404,"message":"models/x is not found for API version v1","status":"NOT_FOUND"}}',
);

function args(signal: AbortSignal = new AbortController().signal): GenerateJsonArgs {
  return { system: 'sys', user: 'user', schema: { type: 'object' }, signal };
}

function scripted(...outcomes: (string | Error)[]): { generate: GenerateFn; models: string[] } {
  const models: string[] = [];
  const generate: GenerateFn = (model) => {
    models.push(model);
    const next = outcomes.shift();
    if (next === undefined) return Promise.reject(new Error('no scripted outcome'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve({ text: next });
  };
  return { generate, models };
}

const noSleep = (): Promise<void> => Promise.resolve();

describe('classifyGeminiError', () => {
  it('recognises overload, quota and other errors', () => {
    expect(classifyGeminiError(overloaded)).toBe('overloaded');
    expect(classifyGeminiError(Object.assign(new Error('x'), { status: 503 }))).toBe('overloaded');
    expect(classifyGeminiError(quota)).toBe('rate-limited');
    expect(classifyGeminiError(badRequest)).toBe('other');
    expect(classifyGeminiError(notFound)).toBe('not-found');
  });
});

describe('createGeminiClient', () => {
  it('returns the text on the first success with one call', async () => {
    const { generate, models } = scripted('{"ok":true}');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', generate, sleep: noSleep });
    await expect(client.generateJson(args())).resolves.toBe('{"ok":true}');
    expect(models).toEqual(['main']);
  });

  it('retries the same model once when it is overloaded and no fallback is set', async () => {
    const { generate, models } = scripted(overloaded, '{"ok":true}');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', generate, sleep: noSleep });
    await expect(client.generateJson(args())).resolves.toBe('{"ok":true}');
    expect(models).toEqual(['main', 'main']);
  });

  it('switches to the fallback model when the main one is overloaded', async () => {
    const { generate, models } = scripted(overloaded, '{"ok":true}');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', fallbackModels: ['backup'], generate, sleep: noSleep });
    await expect(client.generateJson(args())).resolves.toBe('{"ok":true}');
    expect(models).toEqual(['main', 'backup']);
  });

  it('uses the fallback model on quota errors, but never retries the same model', async () => {
    const withFallback = scripted(quota, '{"ok":true}');
    const a = createGeminiClient({ apiKey: 'k', model: 'main', fallbackModels: ['backup'], generate: withFallback.generate, sleep: noSleep });
    await expect(a.generateJson(args())).resolves.toBe('{"ok":true}');
    expect(withFallback.models).toEqual(['main', 'backup']);

    const noFallback = scripted(quota);
    const b = createGeminiClient({ apiKey: 'k', model: 'main', generate: noFallback.generate, sleep: noSleep });
    await expect(b.generateJson(args())).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(noFallback.models).toEqual(['main']);
  });

  it('does not retry other errors and keeps the provider message for the logs', async () => {
    const { generate, models } = scripted(badRequest);
    const client = createGeminiClient({ apiKey: 'k', model: 'main', fallbackModels: ['backup'], generate, sleep: noSleep });
    const err = await client.generateJson(args()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('UPSTREAM_UNAVAILABLE');
    expect((err as AppError).message).toContain('INVALID_ARGUMENT');
    expect(models).toEqual(['main']);
  });

  it('fails with UPSTREAM_UNAVAILABLE when both tries are overloaded', async () => {
    const { generate, models } = scripted(overloaded, overloaded);
    const client = createGeminiClient({ apiKey: 'k', model: 'main', generate, sleep: noSleep });
    await expect(client.generateJson(args())).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(models).toHaveLength(2);
  });

  it('treats an empty response as an error without retrying', async () => {
    const { generate, models } = scripted('');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', generate, sleep: noSleep });
    await expect(client.generateJson(args())).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', status: 502 });
    expect(models).toEqual(['main']);
  });

  it('does not retry after the request was aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { generate, models } = scripted(overloaded, '{"ok":true}');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', generate, sleep: noSleep });
    await expect(client.generateJson(args(controller.signal))).rejects.toMatchObject({ status: 504 });
    expect(models).toEqual(['main']);
  });

  it('gives up cleanly when the abort happens during the pause', async () => {
    const { generate, models } = scripted(overloaded, '{"ok":true}');
    const sleep = vi.fn().mockRejectedValue(new Error('aborted'));
    const client = createGeminiClient({ apiKey: 'k', model: 'main', generate, sleep });
    await expect(client.generateJson(args())).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(models).toEqual(['main']);
  });

  it('tries the fallback model when the first call runs out of time', async () => {
    const slow = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    const { generate, models } = scripted(slow, '{"ok":true}');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', fallbackModels: ['backup'], generate, sleep: noSleep });
    await expect(client.generateJson(args())).resolves.toBe('{"ok":true}');
    expect(models).toEqual(['main', 'backup']);
  });

  it('leaves room in the request budget for two calls and the pause', () => {
    expect(AI_REQUEST_BUDGET_MS).toBeGreaterThan(2 * GEMINI_CALL_TIMEOUT_MS + 1500);
  });

  it('walks through several backup models in order', async () => {
    const { generate, models } = scripted(overloaded, overloaded, '{"ok":true}');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', fallbackModels: ['b1', 'b2'], generate, sleep: noSleep });
    await expect(client.generateJson(args())).resolves.toBe('{"ok":true}');
    expect(models).toEqual(['main', 'b1', 'b2']);
  });

  it('stops after the last backup model', async () => {
    const { generate, models } = scripted(overloaded, overloaded, overloaded, '{"never":"used"}');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', fallbackModels: ['b1', 'b2'], generate, sleep: noSleep });
    await expect(client.generateJson(args())).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(models).toEqual(['main', 'b1', 'b2']);
  });

  it('pauses longer before each further try, up to 4 seconds', async () => {
    const { generate } = scripted(overloaded, overloaded, overloaded, overloaded, '{"ok":true}');
    const pauses: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      pauses.push(ms);
      return Promise.resolve();
    };
    const client = createGeminiClient({ apiKey: 'k', model: 'main', fallbackModels: ['b1', 'b2', 'b3', 'b4'], generate, sleep });
    await expect(client.generateJson(args())).resolves.toBe('{"ok":true}');
    expect(pauses).toEqual([1500, 3000, 4000, 4000]);
  });

  it('skips a model id that is not available and moves on to the next one', async () => {
    const { generate, models } = scripted(notFound, '{"ok":true}');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', fallbackModels: ['b1'], generate, sleep: noSleep });
    await expect(client.generateJson(args())).resolves.toBe('{"ok":true}');
    expect(models).toEqual(['main', 'b1']);
  });

  it('does not retry the same model when its id is not available', async () => {
    const { generate, models } = scripted(notFound, '{"never":"used"}');
    const client = createGeminiClient({ apiKey: 'k', model: 'main', generate, sleep: noSleep });
    await expect(client.generateJson(args())).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(models).toEqual(['main']);
  });

  it('asks Gemini 3 models for minimal/low thinking and leaves other ids on their default', () => {
    expect(thinkingConfigFor('gemini-3.6-flash')).toEqual({ thinkingLevel: 'MINIMAL' });
    expect(thinkingConfigFor('gemini-3.5-flash-lite')).toEqual({ thinkingLevel: 'MINIMAL' });
    expect(thinkingConfigFor('gemini-3-pro')).toEqual({ thinkingLevel: 'LOW' });
    expect(thinkingConfigFor('gemini-flash-lite-latest')).toBeUndefined();
  });

  it('builds the model chain without blanks or duplicates', () => {
    expect(modelChain('main', [' b1 ', '', 'main', 'b1', 'b2'])).toEqual(['main', 'b1', 'b2']);
    expect(modelChain('main')).toEqual(['main']);
  });

  it('builds a real SDK-backed client when no generate function is injected', () => {
    expect(createGeminiClient({ apiKey: 'k', model: 'main' })).toHaveProperty('generateJson');
  });
});
