import { ProviderName, ModelConfig, estimateCost } from '../config/model-routing';
import { StageCost } from '../types/JobState';

export interface GatewayRequest {
  systemPrompt: string;
  userPrompt: string;
  modelConfig: ModelConfig;
}

export interface GatewayResponse {
  text: string;
  cost: StageCost;
}

type OpenAILikeResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type AnthropicResponse = {
  content?: Array<{ text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

class GatewayHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly provider: string,
  ) {
    super(message);
  }
}

// ─── Provider implementations ────────────────────────────────────────────────

async function callOpenAI(req: GatewayRequest): Promise<GatewayResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: req.modelConfig.model,
      max_tokens: req.modelConfig.maxTokens,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GatewayHttpError(`OpenAI ${res.status}: ${err}`, res.status, 'openai');
  }

  const data = await parseJson<OpenAILikeResponse>(res);
  const text: string = data.choices?.[0]?.message?.content ?? '';
  const promptTokens: number = data.usage?.prompt_tokens ?? 0;
  const completionTokens: number = data.usage?.completion_tokens ?? 0;

  return {
    text,
    cost: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedUSD: estimateCost(req.modelConfig.provider, req.modelConfig.model, promptTokens, completionTokens),
      provider: req.modelConfig.provider,
      model: req.modelConfig.model,
    },
  };
}

async function callAnthropic(req: GatewayRequest): Promise<GatewayResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.modelConfig.model,
      max_tokens: req.modelConfig.maxTokens,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GatewayHttpError(`Anthropic ${res.status}: ${err}`, res.status, 'anthropic');
  }

  const data = await parseJson<AnthropicResponse>(res);
  const text: string = data.content?.[0]?.text ?? '';
  const promptTokens: number = data.usage?.input_tokens ?? 0;
  const completionTokens: number = data.usage?.output_tokens ?? 0;

  return {
    text,
    cost: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedUSD: estimateCost(req.modelConfig.provider, req.modelConfig.model, promptTokens, completionTokens),
      provider: req.modelConfig.provider,
      model: req.modelConfig.model,
    },
  };
}

async function callGroq(req: GatewayRequest): Promise<GatewayResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: req.modelConfig.model,
      max_tokens: req.modelConfig.maxTokens,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GatewayHttpError(`Groq ${res.status}: ${err}`, res.status, 'groq');
  }

  const data = await parseJson<OpenAILikeResponse>(res);
  const text: string = data.choices?.[0]?.message?.content ?? '';
  const promptTokens: number = data.usage?.prompt_tokens ?? 0;
  const completionTokens: number = data.usage?.completion_tokens ?? 0;

  return {
    text,
    cost: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedUSD: estimateCost(req.modelConfig.provider, req.modelConfig.model, promptTokens, completionTokens),
      provider: req.modelConfig.provider,
      model: req.modelConfig.model,
    },
  };
}

function readApiKey(envName: string): string {
  const raw = process.env[envName]?.trim();
  if (!raw) throw new Error(`${envName} not set`);
  return raw;
}

function readOpenRouterKey(): string {
  const key = readApiKey('OPENROUTER_API_KEY');
  // Common copy/paste mistake: key starts with "k-or-v1-" instead of "sk-or-v1-"
  if (key.startsWith('k-or-v1-')) return `s${key}`;
  return key;
}

async function callOpenRouter(req: GatewayRequest): Promise<GatewayResponse> {
  const apiKey = readOpenRouterKey();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://oneatlas.dev',
    },
    body: JSON.stringify({
      model: req.modelConfig.model,
      max_tokens: req.modelConfig.maxTokens,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GatewayHttpError(`OpenRouter ${res.status}: ${err}`, res.status, 'openrouter');
  }

  const data = await parseJson<OpenAILikeResponse>(res);
  const text: string = data.choices?.[0]?.message?.content ?? '';
  const promptTokens: number = data.usage?.prompt_tokens ?? 0;
  const completionTokens: number = data.usage?.completion_tokens ?? 0;

  return {
    text,
    cost: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedUSD: estimateCost('openrouter', req.modelConfig.model, promptTokens, completionTokens),
      provider: 'openrouter',
      model: req.modelConfig.model,
    },
  };
}

async function callMistral(req: GatewayRequest): Promise<GatewayResponse> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not set');

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: req.modelConfig.model,
      max_tokens: req.modelConfig.maxTokens,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GatewayHttpError(`Mistral ${res.status}: ${err}`, res.status, 'mistral');
  }

  const data = await parseJson<OpenAILikeResponse>(res);
  const text: string = data.choices?.[0]?.message?.content ?? '';
  const promptTokens: number = data.usage?.prompt_tokens ?? 0;
  const completionTokens: number = data.usage?.completion_tokens ?? 0;

  return {
    text,
    cost: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedUSD: estimateCost(req.modelConfig.provider, req.modelConfig.model, promptTokens, completionTokens),
      provider: req.modelConfig.provider,
      model: req.modelConfig.model,
    },
  };
}

async function callDeepSeek(req: GatewayRequest): Promise<GatewayResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: req.modelConfig.model,
      max_tokens: req.modelConfig.maxTokens,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GatewayHttpError(`DeepSeek ${res.status}: ${err}`, res.status, 'deepseek');
  }

  const data = await parseJson<OpenAILikeResponse>(res);
  const text: string = data.choices?.[0]?.message?.content ?? '';
  const promptTokens: number = data.usage?.prompt_tokens ?? 0;
  const completionTokens: number = data.usage?.completion_tokens ?? 0;

  return {
    text,
    cost: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedUSD: estimateCost(req.modelConfig.provider, req.modelConfig.model, promptTokens, completionTokens),
      provider: req.modelConfig.provider,
      model: req.modelConfig.model,
    },
  };
}

async function callGemini(req: GatewayRequest): Promise<GatewayResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.modelConfig.model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${req.systemPrompt}\n\n${req.userPrompt}` }],
      }],
      generationConfig: {
        maxOutputTokens: req.modelConfig.maxTokens,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GatewayHttpError(`Gemini ${res.status}: ${err}`, res.status, 'gemini');
  }

  const data = await parseJson<GeminiResponse>(res);
  const text: string = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  const promptTokens: number = data.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens: number = data.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    text,
    cost: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedUSD: estimateCost(req.modelConfig.provider, req.modelConfig.model, promptTokens, completionTokens),
      provider: req.modelConfig.provider,
      model: req.modelConfig.model,
    },
  };
}

async function callGoogleAi(req: GatewayRequest): Promise<GatewayResponse> {
  const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.modelConfig.model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${req.systemPrompt}\n\n${req.userPrompt}` }],
      }],
      generationConfig: {
        maxOutputTokens: req.modelConfig.maxTokens,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GatewayHttpError(`GoogleAI ${res.status}: ${err}`, res.status, 'google_ai');
  }

  const data = await parseJson<GeminiResponse>(res);
  const text: string = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  const promptTokens: number = data.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens: number = data.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    text,
    cost: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedUSD: estimateCost(req.modelConfig.provider, req.modelConfig.model, promptTokens, completionTokens),
      provider: req.modelConfig.provider,
      model: req.modelConfig.model,
    },
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────

async function callProvider(req: GatewayRequest): Promise<GatewayResponse> {
  switch (req.modelConfig.provider) {
    case 'openai':     return callOpenAI(req);
    case 'anthropic':  return callAnthropic(req);
    case 'groq':       return callGroq(req);
    case 'deepseek':   return callDeepSeek(req);
    case 'gemini':     return callGemini(req);
    case 'google_ai':  return callGoogleAi(req);
    case 'openrouter': return callOpenRouter(req);
    case 'mistral':    return callMistral(req);
    default:
      // Unsupported providers fall back to OpenRouter
      return callOpenRouter({ ...req, modelConfig: { ...req.modelConfig, provider: 'openrouter' } });
  }
}

// ─── Main gateway call with automatic fallback ────────────────────────────────

export async function gatewayCall(
  primary: ModelConfig,
  fallback: ModelConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<GatewayResponse> {
  try {
    return await callProvider({ systemPrompt, userPrompt, modelConfig: primary });
  } catch (primaryErr) {
    console.warn(`[gateway] Primary provider ${primary.provider}/${primary.model} failed:`, primaryErr);
    const shouldFallback = primaryErr instanceof GatewayHttpError
      && (primaryErr.status === 429 || primaryErr.status >= 500);
    if (!shouldFallback) throw primaryErr;
    try {
      return await callProvider({ systemPrompt, userPrompt, modelConfig: fallback });
    } catch (fallbackErr) {
      console.error(`[gateway] Fallback provider also failed:`, fallbackErr);
      throw fallbackErr;
    }
  }
}

// ─── JSON extraction helper ───────────────────────────────────────────────────

export function extractJSON(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Find first { or [ and last } or ]
  const start = text.search(/[{[]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1).trim();
  }
  return text.trim();
}