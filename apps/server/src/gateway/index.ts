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
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text: string = data.choices[0].message.content ?? '';
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
    throw new Error(`Anthropic ${res.status}: ${err}`);
  }

  const data = await res.json();
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
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text: string = data.choices[0].message.content ?? '';
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

async function callOpenRouter(req: GatewayRequest): Promise<GatewayResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

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
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text: string = data.choices[0].message.content ?? '';
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
    throw new Error(`Mistral ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text: string = data.choices[0].message.content ?? '';
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

// ─── Router ──────────────────────────────────────────────────────────────────

async function callProvider(req: GatewayRequest): Promise<GatewayResponse> {
  switch (req.modelConfig.provider) {
    case 'openai':     return callOpenAI(req);
    case 'anthropic':  return callAnthropic(req);
    case 'groq':       return callGroq(req);
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