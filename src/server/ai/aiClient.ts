export interface GenerateJsonArgs {
  readonly system: string;
  readonly user: string;
  readonly schema: object;
  readonly signal: AbortSignal;
}

export interface AiClient {
  generateJson(args: GenerateJsonArgs): Promise<string>;
}
