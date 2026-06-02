export type ProviderName =
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'gemini'
  | 'deepseek'
  | 'openrouter'
  | 'mistral'
  | 'google_ai';

export interface ModelConfig {
  provider: ProviderName;
  model: string;
  maxTokens: number;
}

export interface StageRoutingConfig {
  primary: ModelConfig;
  fallback: ModelConfig;
  policy?: {
    maxEstimatedCostUsd?: number;
    maxLatencyMs?: number;
    forceProvider?: ProviderName;
  };
}

export interface RoutingConfig {
  intentExtraction: StageRoutingConfig;
  schemaGeneration: StageRoutingConfig;
  appspecGeneration: StageRoutingConfig;
  repair: StageRoutingConfig;
}

export const ROUTING_CONFIG: RoutingConfig = {
  intentExtraction: {
    primary: { provider: 'groq', model: 'llama3-8b-8192', maxTokens: 1000 },
    fallback: { provider: 'openrouter', model: 'meta-llama/llama-3-8b-instruct', maxTokens: 1000 },
    policy: { maxEstimatedCostUsd: 0.01, maxLatencyMs: 6000 },
  },
  schemaGeneration: {
    primary: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', maxTokens: 4000 },
    fallback: { provider: 'openrouter', model: 'anthropic/claude-haiku-4-5', maxTokens: 4000 },
    policy: { maxEstimatedCostUsd: 0.15, maxLatencyMs: 16000 },
  },
  appspecGeneration: {
    primary: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', maxTokens: 6000 },
    fallback: { provider: 'openrouter', model: 'openai/gpt-4o-mini', maxTokens: 6000 },
    policy: { maxEstimatedCostUsd: 0.20, maxLatencyMs: 22000 },
  },
  repair: {
    primary: { provider: 'groq', model: 'llama3-8b-8192', maxTokens: 2000 },
    fallback: { provider: 'openrouter', model: 'meta-llama/llama-3-8b-instruct', maxTokens: 2000 },
  },
};

// Cost per 1M tokens in USD
export const COST_TABLE: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o':                          { input: 5.00,  output: 15.00 },
  'openai/gpt-4o-mini':                     { input: 0.15,  output: 0.60  },
  'anthropic/claude-sonnet-4-20250514':     { input: 3.00,  output: 15.00 },
  'anthropic/claude-haiku-4-5-20251001':    { input: 0.80,  output: 4.00  },
  'groq/llama3-8b-8192':                    { input: 0.05,  output: 0.10  },
  'groq/mixtral-8x7b-32768':               { input: 0.24,  output: 0.24  },
  'deepseek/deepseek-chat':                 { input: 0.14,  output: 0.28  },
  'mistral/mistral-large-latest':           { input: 4.00,  output: 12.00 },
  'mistral/mistral-7b':                     { input: 0.25,  output: 0.25  },
  'google/gemini-1.5-flash':               { input: 0.075, output: 0.30  },
  'google/gemini-1.5-pro':                 { input: 3.50,  output: 10.50 },
  'openrouter/meta-llama/llama-3-8b-instruct': { input: 0.06, output: 0.06 },
};

export function estimateCost(
  provider: ProviderName,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const key = `${provider}/${model}`;
  const rates = COST_TABLE[key] ?? { input: 0.50, output: 1.50 };
  return (promptTokens * rates.input + completionTokens * rates.output) / 1_000_000;
}

export function applyStagePolicy(config: StageRoutingConfig): StageRoutingConfig {
  if (!config.policy?.forceProvider) return config;
  return {
    ...config,
    primary: {
      ...config.primary,
      provider: config.policy.forceProvider,
    },
  };
}