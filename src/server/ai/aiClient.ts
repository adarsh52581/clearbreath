/** Total time allowed for one AI request, including the client's retry on a second model. */
export const AI_REQUEST_BUDGET_MS = 45_000;

export interface GenerateJsonArgs {
  readonly system: string;
  readonly user: string;
  readonly schema: object;
  readonly signal: AbortSignal;
}

export interface AiClient {
  generateJson(args: GenerateJsonArgs): Promise<string>;
}
