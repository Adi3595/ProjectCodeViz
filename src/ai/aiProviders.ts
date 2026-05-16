import * as https from 'https';
import * as http from 'http';

// ============================================================
// AI Provider Interfaces & Types
// ============================================================

export type AIProviderType = 'openai' | 'gemini' | 'anthropic' | 'mistral' | 'cohere' | 'groq';

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  provider: AIProviderType;
  model: string;
  tokensUsed?: number;
}

// ============================================================
// Provider Metadata
// ============================================================

export interface ProviderMeta {
  label: string;
  defaultModel: string;
  models: string[];
  placeholder: string;
  docUrl: string;
}

export const PROVIDER_META: Record<AIProviderType, ProviderMeta> = {
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini', 'o1-preview'],
    placeholder: 'sk-...',
    docUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    placeholder: 'AIza...',
    docUrl: 'https://aistudio.google.com/app/apikey',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    placeholder: 'sk-ant-...',
    docUrl: 'https://console.anthropic.com/settings/keys',
  },
  mistral: {
    label: 'Mistral AI',
    defaultModel: 'mistral-small-latest',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-7b'],
    placeholder: 'Your Mistral API key',
    docUrl: 'https://console.mistral.ai/api-keys/',
  },
  cohere: {
    label: 'Cohere',
    defaultModel: 'command-r-plus',
    models: ['command-r-plus', 'command-r', 'command-light'],
    placeholder: 'Your Cohere API key',
    docUrl: 'https://dashboard.cohere.com/api-keys',
  },
  groq: {
    label: 'Groq',
    defaultModel: 'llama-3.1-70b-versatile',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    placeholder: 'gsk_...',
    docUrl: 'https://console.groq.com/keys',
  },
};

// ============================================================
// HTTP Request Helper (no dependencies)
// ============================================================

function httpRequest(
  url: string,
  options: { method: string; headers: Record<string, string>; body?: string; timeout?: number }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOpts: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method,
      headers: options.headers,
      timeout: options.timeout || 60000,
    };

    const req = lib.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });

    if (options.body) { req.write(options.body); }
    req.end();
  });
}

// ============================================================
// Provider Implementations
// ============================================================

async function callOpenAI(config: AIProviderConfig, messages: AIMessage[]): Promise<AIResponse> {
  const baseUrl = config.baseUrl || 'https://api.openai.com';
  const model = config.model || PROVIDER_META.openai.defaultModel;

  const body = JSON.stringify({
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: 0.3,
    max_tokens: 2048,
  });

  const res = await httpRequest(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body,
  });

  if (res.status !== 200) {
    const err = JSON.parse(res.body);
    throw new Error(`OpenAI API error (${res.status}): ${err.error?.message || res.body}`);
  }

  const json = JSON.parse(res.body);
  return {
    text: json.choices?.[0]?.message?.content || '',
    provider: 'openai',
    model,
    tokensUsed: json.usage?.total_tokens,
  };
}

async function callGemini(config: AIProviderConfig, messages: AIMessage[]): Promise<AIResponse> {
  const model = config.model || PROVIDER_META.gemini.defaultModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

  // Convert messages to Gemini format
  const systemInstruction = messages.find(m => m.role === 'system')?.content;
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (res.status !== 200) {
    const err = JSON.parse(res.body);
    throw new Error(`Gemini API error (${res.status}): ${err.error?.message || res.body}`);
  }

  const json = JSON.parse(res.body);
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return {
    text,
    provider: 'gemini',
    model,
    tokensUsed: json.usageMetadata?.totalTokenCount,
  };
}

async function callAnthropic(config: AIProviderConfig, messages: AIMessage[]): Promise<AIResponse> {
  const model = config.model || PROVIDER_META.anthropic.defaultModel;

  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  const body = JSON.stringify({
    model,
    max_tokens: 2048,
    system: systemMsg,
    messages: chatMessages,
  });

  const res = await httpRequest('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  if (res.status !== 200) {
    const err = JSON.parse(res.body);
    throw new Error(`Anthropic API error (${res.status}): ${err.error?.message || res.body}`);
  }

  const json = JSON.parse(res.body);
  const text = json.content?.[0]?.text || '';
  return {
    text,
    provider: 'anthropic',
    model,
    tokensUsed: (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0),
  };
}

async function callMistral(config: AIProviderConfig, messages: AIMessage[]): Promise<AIResponse> {
  const model = config.model || PROVIDER_META.mistral.defaultModel;

  const body = JSON.stringify({
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: 0.3,
    max_tokens: 2048,
  });

  const res = await httpRequest('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body,
  });

  if (res.status !== 200) {
    const err = JSON.parse(res.body);
    throw new Error(`Mistral API error (${res.status}): ${err.error?.message || res.body}`);
  }

  const json = JSON.parse(res.body);
  return {
    text: json.choices?.[0]?.message?.content || '',
    provider: 'mistral',
    model,
    tokensUsed: json.usage?.total_tokens,
  };
}

async function callCohere(config: AIProviderConfig, messages: AIMessage[]): Promise<AIResponse> {
  const model = config.model || PROVIDER_META.cohere.defaultModel;

  const systemMsg = messages.find(m => m.role === 'system')?.content;
  const chatHistory = messages
    .filter(m => m.role !== 'system')
    .slice(0, -1)
    .map(m => ({
      role: m.role === 'user' ? 'USER' : 'CHATBOT',
      message: m.content,
    }));
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';

  const body = JSON.stringify({
    model,
    message: lastUserMsg,
    chat_history: chatHistory,
    preamble: systemMsg,
    temperature: 0.3,
    max_tokens: 2048,
  });

  const res = await httpRequest('https://api.cohere.ai/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body,
  });

  if (res.status !== 200) {
    const err = JSON.parse(res.body);
    throw new Error(`Cohere API error (${res.status}): ${err.message || res.body}`);
  }

  const json = JSON.parse(res.body);
  return {
    text: json.text || '',
    provider: 'cohere',
    model,
    tokensUsed: json.meta?.billed_units?.input_tokens ? json.meta.billed_units.input_tokens + json.meta.billed_units.output_tokens : undefined,
  };
}

async function callGroq(config: AIProviderConfig, messages: AIMessage[]): Promise<AIResponse> {
  const model = config.model || PROVIDER_META.groq.defaultModel;

  const body = JSON.stringify({
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: 0.3,
    max_tokens: 2048,
  });

  const res = await httpRequest('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body,
  });

  if (res.status !== 200) {
    const err = JSON.parse(res.body);
    throw new Error(`Groq API error (${res.status}): ${err.error?.message || res.body}`);
  }

  const json = JSON.parse(res.body);
  return {
    text: json.choices?.[0]?.message?.content || '',
    provider: 'groq',
    model,
    tokensUsed: json.usage?.total_tokens,
  };
}

// ============================================================
// Unified Call Function
// ============================================================

export async function callAI(config: AIProviderConfig, messages: AIMessage[]): Promise<AIResponse> {
  switch (config.type) {
    case 'openai': return callOpenAI(config, messages);
    case 'gemini': return callGemini(config, messages);
    case 'anthropic': return callAnthropic(config, messages);
    case 'mistral': return callMistral(config, messages);
    case 'cohere': return callCohere(config, messages);
    case 'groq': return callGroq(config, messages);
    default:
      throw new Error(`Unsupported AI provider: ${config.type}`);
  }
}
