export type RuleCategory =
  | 'Dining'
  | 'Check-in & Check-out'
  | 'Wellness & Spa'
  | 'Pets & Accessibility'
  | 'Parking & Transport'
  | 'Wi-Fi & Workspace'
  | 'Cancellation & Billing';

export interface HotelRule {
  id: string;
  title: string;
  category: RuleCategory;
  content: string;
  updatedAt: string;
}

export interface RetrievedChunk {
  id: string;
  title: string;
  category: string;
  content: string;
  distance: number;
  similarity: number;
}

export interface InferenceStats {
  totalMs: number;
  firstTokenMs: number | null;
  promptTokens: number;
  completionTokens: number;
  tokensPerSec: number;
}

export interface RetrievalPayload {
  chunks: RetrievedChunk[];
  retrievalMs: number;
  topK: number;
  minSimilarity: number;
  augmentedSystemPrompt: string;
  augmentedUserPrompt: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  ollama: {
    connected: boolean;
    baseUrl: string;
    llmModel: string;
    embedModel: string;
    llmAvailable: boolean;
    embedAvailable: boolean;
    thinkDefault: boolean;
    numCtx: number;
    loadedModels: Array<{ name: string; sizeVramMb: number }>;
    error?: string;
  };
  chroma: {
    connected: boolean;
    url: string;
    collection: string;
    indexedCount: number;
    error?: string;
  };
  rulesCount: number;
}

export interface SampleQuestion {
  label: string;
  question: string;
}

export type PanelStatus = 'idle' | 'queued' | 'retrieving' | 'streaming' | 'done' | 'error';

export interface ComparisonState {
  question: string;
  executionMode: 'sequential' | 'parallel';
  directStatus: PanelStatus;
  directText: string;
  directStats: InferenceStats | null;
  directError: string | null;
  ragStatus: PanelStatus;
  ragText: string;
  ragStats: InferenceStats | null;
  ragError: string | null;
  retrieval: RetrievalPayload | null;
}
