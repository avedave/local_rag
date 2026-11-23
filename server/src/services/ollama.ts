import { config } from '../config.js';
import {
  RULE_CATEGORIES,
  type HotelRule,
  type InferenceStats,
  type RuleCategory,
} from '../types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaEmbedResponse {
  embeddings: number[][];
}

interface OllamaChatChunk {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
  total_duration?: number;
  error?: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}

interface OllamaPsResponse {
  models?: Array<{ name: string; size_vram?: number }>;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch(`${config.ollamaBaseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.embedModel,
      input: texts,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama embed failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as OllamaEmbedResponse;
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
    throw new Error('Unexpected response format from Ollama /api/embed');
  }
  return data.embeddings;
}

export async function streamChat(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; stats: InferenceStats }> {
  const startedAt = performance.now();
  let firstTokenMs: number | null = null;
  let fullText = '';
  let promptTokens = 0;
  let completionTokens = 0;
  let evalDurationNs = 0;

  const res = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: config.llmModel,
      messages,
      stream: true,
      think: config.ollamaThink,
      options: {
        num_ctx: config.ollamaNumCtx,
        temperature: config.ollamaTemperature,
      },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama chat failed (${res.status}): ${body}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        const chunk = JSON.parse(line) as OllamaChatChunk;
        if (chunk.error) {
          throw new Error(`Ollama stream error: ${chunk.error}`);
        }
        const token = chunk.message?.content ?? '';
        if (token.length > 0) {
          if (firstTokenMs === null) {
            firstTokenMs = Math.round(performance.now() - startedAt);
          }
          fullText += token;
          onToken(token);
        }
        if (chunk.done) {
          promptTokens = chunk.prompt_eval_count ?? 0;
          completionTokens = chunk.eval_count ?? 0;
          evalDurationNs = chunk.eval_duration ?? 0;
        }
      }
      newlineIndex = buffer.indexOf('\n');
    }
  }

  const totalMs = Math.round(performance.now() - startedAt);
  const evalSec = evalDurationNs > 0 ? evalDurationNs / 1e9 : totalMs / 1000;
  const tokensPerSec =
    completionTokens > 0 && evalSec > 0 ? Number((completionTokens / evalSec).toFixed(1)) : 0;

  return {
    text: fullText.trim(),
    stats: {
      totalMs,
      firstTokenMs,
      promptTokens,
      completionTokens,
      tokensPerSec,
    },
  };
}

export async function generateHotelRule(
  existingRules: HotelRule[],
  topicHint?: string,
): Promise<{ title: string; category: RuleCategory; content: string }> {
  const existingTitles = existingRules.map((r) => `- ${r.title}`).join('\n');
  const categoryList = RULE_CATEGORIES.join(', ');

  const userPrompt = [
    'Generate ONE new, practical, specific hotel rule for the fictional "Grand Aurora Hotel".',
    'Keep it simple, concrete, and easy to remember (include specific hours, floor numbers, prices, or limits — e.g. "Bicycles may be borrowed free of charge for up to 3 hours between 7:00 AM and 8:00 PM.").',
    topicHint?.trim() ? `Requested topic: ${topicHint.trim()}` : 'Pick a useful guest topic not covered below.',
    '',
    'Existing rule titles (do not duplicate these):',
    existingTitles || '(none)',
    '',
    `Allowed categories (pick exactly one): ${categoryList}`,
    '',
    'Respond ONLY with a valid JSON object with keys: "title" (3-6 words), "category" (exact string from allowed categories), and "content" (1-2 clear sentences).',
  ].join('\n');

  const res = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.llmModel,
      stream: false,
      think: false,
      format: 'json',
      options: {
        num_ctx: config.ollamaNumCtx,
        temperature: 0.7,
      },
      messages: [
        {
          role: 'system',
          content: 'You output strictly valid JSON objects for hotel hospitality documentation.',
        },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama rule generation failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const raw = data.message?.content?.trim() || '{}';
  const parsed = JSON.parse(raw) as { title?: string; category?: string; content?: string };

  const title = (parsed.title || 'New Hotel Policy').trim();
  const content = (parsed.content || '').trim();
  const category: RuleCategory = (RULE_CATEGORIES as readonly string[]).includes(parsed.category || '')
    ? (parsed.category as RuleCategory)
    : 'Check-in & Check-out';

  if (!content) {
    throw new Error('Model returned an empty rule body. Please try generating again.');
  }

  return { title, category, content };
}

function modelMatches(installedName: string, target: string): boolean {
  if (installedName === target) return true;
  if (!target.includes(':') && installedName === `${target}:latest`) return true;
  return false;
}

export async function checkOllamaHealth() {
  try {
    const [tagsRes, psRes] = await Promise.all([
      fetch(`${config.ollamaBaseUrl}/api/tags`),
      fetch(`${config.ollamaBaseUrl}/api/ps`).catch(() => null),
    ]);

    if (!tagsRes.ok) {
      throw new Error(`HTTP ${tagsRes.status}`);
    }

    const tagsData = (await tagsRes.json()) as OllamaTagsResponse;
    const names = (tagsData.models || []).map((m) => m.name);

    let loadedModels: Array<{ name: string; sizeVramMb: number }> = [];
    if (psRes && psRes.ok) {
      const psData = (await psRes.json()) as OllamaPsResponse;
      loadedModels = (psData.models || []).map((m) => ({
        name: m.name,
        sizeVramMb: Math.round((m.size_vram || 0) / (1024 * 1024)),
      }));
    }

    return {
      connected: true,
      baseUrl: config.ollamaBaseUrl,
      llmModel: config.llmModel,
      embedModel: config.embedModel,
      llmAvailable: names.some((n) => modelMatches(n, config.llmModel)),
      embedAvailable: names.some((n) => modelMatches(n, config.embedModel)),
      thinkDefault: config.ollamaThink,
      numCtx: config.ollamaNumCtx,
      loadedModels,
    };
  } catch (err) {
    return {
      connected: false,
      baseUrl: config.ollamaBaseUrl,
      llmModel: config.llmModel,
      embedModel: config.embedModel,
      llmAvailable: false,
      embedAvailable: false,
      thinkDefault: config.ollamaThink,
      numCtx: config.ollamaNumCtx,
      loadedModels: [],
      error: err instanceof Error ? err.message : 'Unable to reach Ollama',
    };
  }
}
