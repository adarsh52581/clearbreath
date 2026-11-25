import { GoogleGenAI } from '@google/genai';
import { AppError } from '../errors.js';
import type { AiClient, GenerateJsonArgs } from './aiClient.js';

export function createGeminiClient(apiKey: string, model: string): AiClient {
  const ai = new GoogleGenAI({ apiKey });

  return {
    async generateJson({ system, user, schema, signal }: GenerateJsonArgs): Promise<string> {
      try {
        const response = await ai.models.generateContent({
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
            httpOptions: { timeout: 20000 },
          },
        });

        if (!response.text) {
          throw new AppError('UPSTREAM_UNAVAILABLE', 502, 'Gemini returned an empty response');
        }
        return response.text;
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        const lower = msg.toLowerCase();

        if (msg.includes('429') || lower.includes('rate limit') || lower.includes('resource exhausted')) {
          throw new AppError('RATE_LIMITED', 429, 'Gemini rate limit exceeded');
        }
        if (signal.aborted || lower.includes('timeout') || lower.includes('abort') || lower.includes('deadline')) {
          throw new AppError('UPSTREAM_UNAVAILABLE', 504, 'Gemini request timed out');
        }
        throw new AppError('UPSTREAM_UNAVAILABLE', 502, `Gemini upstream error: ${msg}`);
      }
    },
  };
}
