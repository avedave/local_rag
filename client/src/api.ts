import type {
  HealthStatus,
  HotelRule,
  InferenceStats,
  RetrievalPayload,
  RuleCategory,
  SampleQuestion,
} from './types';

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch('/api/health');
  return parseJson<HealthStatus>(res);
}

export async function fetchRules(): Promise<{
  rules: HotelRule[];
  categories: RuleCategory[];
  sampleQuestions: SampleQuestion[];
}> {
  const res = await fetch('/api/rules');
  return parseJson(res);
}

export async function createRuleApi(input: {
  title: string;
  category: RuleCategory;
  content: string;
}): Promise<HotelRule> {
  const res = await fetch('/api/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ rule: HotelRule }>(res);
  return data.rule;
}

export async function updateRuleApi(
  id: string,
  input: { title: string; category: RuleCategory; content: string },
): Promise<HotelRule> {
  const res = await fetch(`/api/rules/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ rule: HotelRule }>(res);
  return data.rule;
}

export async function deleteRuleApi(id: string): Promise<void> {
  const res = await fetch(`/api/rules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await parseJson(res);
}

export async function resetRulesApi(): Promise<HotelRule[]> {
  const res = await fetch('/api/rules/reset', { method: 'POST' });
  const data = await parseJson<{ rules: HotelRule[] }>(res);
  return data.rules;
}

export async function reindexRulesApi(): Promise<number> {
  const res = await fetch('/api/rules/reindex', { method: 'POST' });
  const data = await parseJson<{ indexedCount: number }>(res);
  return data.indexedCount;
}

export async function generateRuleApi(topic?: string): Promise<HotelRule> {
  const res = await fetch('/api/rules/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  });
  const data = await parseJson<{ rule: HotelRule }>(res);
  return data.rule;
}

export interface StreamQueryHandlers {
  onMeta?: (meta: { executionMode: 'sequential' | 'parallel' }) => void;
  onDirectStart?: () => void;
  onDirectToken?: (token: string) => void;
  onDirectDone?: (payload: { text: string; stats: InferenceStats }) => void;
  onDirectError?: (error: string) => void;
  onRagStart?: () => void;
  onRagRetrieval?: (payload: RetrievalPayload) => void;
  onRagToken?: (token: string) => void;
  onRagDone?: (payload: { text: string; stats: InferenceStats }) => void;
  onRagError?: (error: string) => void;
  onDone?: () => void;
}

export async function streamQueryApi(
  params: { question: string; topK: number; minSimilarity: number; parallel: boolean },
  handlers: StreamQueryHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({ error: `Query failed (${res.status})` }));
    throw new Error((body as { error?: string }).error || `Query failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatchEvent = (rawBlock: string) => {
    const lines = rawBlock.split('\n');
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) return;
    const payload = JSON.parse(dataLines.join('\n'));

    switch (eventName) {
      case 'meta':
        handlers.onMeta?.(payload);
        break;
      case 'direct_start':
        handlers.onDirectStart?.();
        break;
      case 'direct_token':
        handlers.onDirectToken?.(payload.token);
        break;
      case 'direct_done':
        handlers.onDirectDone?.(payload);
        break;
      case 'direct_error':
        handlers.onDirectError?.(payload.error);
        break;
      case 'rag_start':
        handlers.onRagStart?.();
        break;
      case 'rag_retrieval':
        handlers.onRagRetrieval?.(payload);
        break;
      case 'rag_token':
        handlers.onRagToken?.(payload.token);
        break;
      case 'rag_done':
        handlers.onRagDone?.(payload);
        break;
      case 'rag_error':
        handlers.onRagError?.(payload.error);
        break;
      case 'done':
        handlers.onDone?.();
        break;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex = buffer.indexOf('\n\n');
    while (sepIndex !== -1) {
      const block = buffer.slice(0, sepIndex).trim();
      buffer = buffer.slice(sepIndex + 2);
      if (block.length > 0) {
        dispatchEvent(block);
      }
      sepIndex = buffer.indexOf('\n\n');
    }
  }
}
