import { GoogleGenAI } from '@google/genai';
import { AppError } from '../errors.js';
import { logEvent } from '../log.js';
import type { AiClient, GenerateJsonArgs } from './aiClient.js';

/** One call may take at most this long, so a slow first model still leaves time for a second try. */
export const GEMINI_CALL_TIMEOUT_MS = 15_000;

/** Calls one Gemini model once; injected in tests. */
export type GenerateFn = (model: string, args: GenerateJsonArgs) => Promise<{ text?: string }>;

export interface GeminiClientOptions {
  apiKey: string;
  model: string;
  /** Optional second model, used when the main one is overloaded (503) or out of quota (429). */
  fallbackModel?: string;
  /** Pause before the second try. */
  retryDelayMs?: number;
  generate?: GenerateFn;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

type FailureKind = 'overloaded' | 'timeout' | 'rate-limited' | 'other';
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

function sdkGenerate(apiKey: string): GenerateFn {
  const ai = new GoogleGenAI({ apiKey });
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
        maxOutputTokens: 2048,
        thinkingConfig: { includeThoughts: false },
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

/** Picks the model for a second try, or null when a retry cannot help. */
function retryModel(kind: FailureKind, model: string, fallbackModel?: string): string | null {
  const fallback = fallbackModel && fallbackModel !== model ? fallbackModel : null;
  if (kind === 'overloaded' || kind === 'timeout') return fallback ?? model; // usually brief
  if (kind === 'rate-limited') return fallback; // same model, same quota: pointless
  return null;
}

export function createGeminiClient(options: GeminiClientOptions): AiClient {
  const { model, fallbackModel, retryDelayMs = 1500 } = options;
  const generate = options.generate ?? sdkGenerate(options.apiKey);
  const sleep = options.sleep ?? abortableSleep;

  return {
    async generateJson(args: GenerateJsonArgs): Promise<string> {
      const first = await attempt(generate, model, args);
      if (first.ok) return first.text;

      const secondModel = retryModel(first.kind, model, fallbackModel);
      if (!secondModel || args.signal.aborted) throw toAppError(first.error, args.signal);

      logEvent('info', 'Retrying Gemini', { reason: first.kind, model: secondModel });
      try {
        await sleep(retryDelayMs, args.signal);
      } catch {
        throw toAppError(first.error, args.signal);
      }
      const second = await attempt(generate, secondModel, args);
      if (second.ok) return second.text;
      throw toAppError(second.error, args.signal);
    },
  };
}
