import { GoogleGenAI, ThinkingLevel, type ThinkingConfig } from '@google/genai';
import { AppError } from '../errors.js';
import { logEvent } from '../log.js';
import type { AiClient, GenerateJsonArgs } from './aiClient.js';

/** One call may take at most this long, so a slow first model still leaves time for a second try. */
export const GEMINI_CALL_TIMEOUT_MS = 20_000;

/** Calls one Gemini model once; injected in tests. */
export type GenerateFn = (model: string, args: GenerateJsonArgs) => Promise<{ text?: string }>;

export interface GeminiClientOptions {
  apiKey: string;
  model: string;
  /** Optional backup models, tried in order when the main one is overloaded (503), slow, or out of quota (429). */
  fallbackModels?: readonly string[];
  /** Pause before the first retry; it doubles for each further retry (max 4 s). */
  retryDelayMs?: number;
  generate?: GenerateFn;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

type FailureKind = 'overloaded' | 'timeout' | 'rate-limited' | 'not-found' | 'other';
type AttemptResult = { ok: true; text: string } | { ok: false; error: unknown; kind: FailureKind };

function errorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const { status } = err;
    if (typeof status === 'number') return status;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = /"code"\s*:\s*(\d{3})/.exec(msg) ?? /\b(429|500|502|503|504)\b/.exec(msg);
  return match ? Number(match[1]) : undefined;
}

export function classifyGeminiError(err: unknown): FailureKind {
  const status = errorStatus(err);
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 429 || /resource.?exhausted|rate limit/i.test(msg)) return 'rate-limited';
  // Model id not available to this key/API version: skip it and move on to the next model.
  if (status === 404 || /not_found|is not found/i.test(msg)) return 'not-found';
  if (status === 500 || status === 503 || /unavailable|overloaded|high demand/i.test(msg)) {
    return 'overloaded';
  }
  return 'other';
}

function isTimeoutLike(err: unknown): boolean {
  const name = err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err);
  return name === 'AbortError' || name === 'TimeoutError' || /timeout|timed out|aborted|deadline/i.test(msg);
}

function toAppError(err: unknown, signal: AbortSignal): AppError {
  if (err instanceof AppError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (classifyGeminiError(err) === 'rate-limited') {
    return new AppError('RATE_LIMITED', 429, 'Gemini rate limit exceeded');
  }
  if (signal.aborted || /timeout|abort|deadline/i.test(msg)) {
    return new AppError('UPSTREAM_UNAVAILABLE', 504, 'Gemini request timed out');
  }
  return new AppError('UPSTREAM_UNAVAILABLE', 502, `Gemini upstream error: ${msg}`);
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}

/**
 * Gemini 3 models think before answering by default, which made full plans take over 15 s.
 * Our options and numbers are pre-computed, so low thinking is enough and much faster.
 * Other ids (e.g. "-latest" aliases) keep the model's default.
 */
export function thinkingConfigFor(model: string): ThinkingConfig | undefined {
  if (!/^gemini-3/i.test(model)) return undefined;
  // Flash models support MINIMAL, the fastest level; other Gemini 3 models get LOW.
  return { thinkingLevel: /flash/i.test(model) ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW };
}

function sdkGenerate(apiKey: string): GenerateFn {
  // v1beta is the version Google's docs use; "-latest" aliases are not served on v1.
  const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
  return (model, { system, user, schema, signal }) =>
    ai.models.generateContent({
      model,
      contents: user,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        // Our schema is standard JSON Schema (from zod), so it goes in responseJsonSchema.
        responseJsonSchema: schema,
        temperature: 0.3,
        // Thinking tokens count towards this limit, so leave headroom to avoid cut-off JSON.
        maxOutputTokens: 4096,
        thinkingConfig: thinkingConfigFor(model),
        abortSignal: signal,
        httpOptions: { timeout: GEMINI_CALL_TIMEOUT_MS },
      },
    });
}

async function attempt(generate: GenerateFn, model: string, args: GenerateJsonArgs): Promise<AttemptResult> {
  try {
    const response = await generate(model, args);
    if (!response.text) {
      const empty = new AppError('UPSTREAM_UNAVAILABLE', 502, 'Gemini returned an empty response');
      return { ok: false, error: empty, kind: 'other' };
    }
    return { ok: true, text: response.text };
  } catch (error: unknown) {
    // A single call that ran out of time (while the overall request still has budget) is treated
    // like an overloaded model: worth one more try, preferably on the fallback model.
    const kind = !args.signal.aborted && isTimeoutLike(error) ? 'timeout' : classifyGeminiError(error);
    return { ok: false, error, kind };
  }
}

const MAX_PAUSE_MS = 4000;

/** Main model first, then the backups, without blanks or duplicates. */
export function modelChain(model: string, fallbacks: readonly string[] = []): string[] {
  return [...new Set([model, ...fallbacks].map((m) => m.trim()).filter((m) => m.length > 0))];
}

/** Picks the model for the next try, or null when another try cannot help. */
function nextModel(kind: FailureKind, chain: readonly string[], index: number): string | null {
  const next = chain[index + 1] ?? null;
  if (kind === 'overloaded' || kind === 'timeout') {
    // No backups configured: give the same model one more chance (demand spikes are often brief).
    if (next === null && chain.length === 1 && index === 0) return chain[0] ?? null;
    return next;
  }
  // A different model has its own quota; an unavailable id is simply skipped.
  if (kind === 'rate-limited' || kind === 'not-found') return next;
  return null;
}

export function createGeminiClient(options: GeminiClientOptions): AiClient {
  const { model, fallbackModels = [], retryDelayMs = 1500 } = options;
  const chain = modelChain(model, fallbackModels);
  const generate = options.generate ?? sdkGenerate(options.apiKey);
  const sleep = options.sleep ?? abortableSleep;

  return {
    async generateJson(args: GenerateJsonArgs): Promise<string> {
      let index = 0;
      let current = chain[0] ?? model;
      for (;;) {
        const startedAt = Date.now();
        const result = await attempt(generate, current, args);
        if (result.ok) {
          logEvent('info', 'Gemini answered', { model: current, ms: Date.now() - startedAt });
          return result.text;
        }

        const next = nextModel(result.kind, chain, index);
        if (next === null || args.signal.aborted) throw toAppError(result.error, args.signal);

        logEvent('info', 'Retrying Gemini', { reason: result.kind, model: next });
        try {
          await sleep(Math.min(retryDelayMs * 2 ** index, MAX_PAUSE_MS), args.signal);
        } catch {
          throw toAppError(result.error, args.signal);
        }
        current = next;
        index += 1;
      }
    },
  };
}
