import { ChromaClient, type Collection } from 'chromadb';
import { config } from '../config.js';
import type { HotelRule, RetrievedChunk } from '../types.js';
import { embedTexts } from './ollama.js';

const chromaClient = new ChromaClient({
  host: config.chromaHost,
  port: config.chromaPort,
  ssl: false,
});

function formatRuleDocument(rule: HotelRule): string {
  return `[${rule.category}] ${rule.title}: ${rule.content}`;
}

export async function getRulesCollection(): Promise<Collection> {
  return chromaClient.getOrCreateCollection({
    name: config.chromaCollection,
    metadata: { 'hnsw:space': 'cosine' },
    embeddingFunction: null,
  });
}

export async function upsertRulesInChroma(rules: HotelRule[]): Promise<void> {
  if (rules.length === 0) return;
  const collection = await getRulesCollection();
  const documents = rules.map(formatRuleDocument);
  const embeddings = await embedTexts(documents);

  await collection.upsert({
    ids: rules.map((r) => r.id),
    embeddings,
    documents,
    metadatas: rules.map((r) => ({
      title: r.title,
      category: r.category,
      content: r.content,
      updatedAt: r.updatedAt,
    })),
  });
}

export async function deleteRuleFromChroma(id: string): Promise<void> {
  const collection = await getRulesCollection();
  await collection.delete({ ids: [id] });
}

export async function resetChromaCollection(rules: HotelRule[]): Promise<void> {
  try {
    await chromaClient.deleteCollection({ name: config.chromaCollection });
  } catch {
    // Collection may not exist yet — safe to ignore
  }
  const collection = await getRulesCollection();
  if (rules.length === 0) return;

  const documents = rules.map(formatRuleDocument);
  const embeddings = await embedTexts(documents);

  await collection.upsert({
    ids: rules.map((r) => r.id),
    embeddings,
    documents,
    metadatas: rules.map((r) => ({
      title: r.title,
      category: r.category,
      content: r.content,
      updatedAt: r.updatedAt,
    })),
  });
}

export async function searchRulesInChroma(
  query: string,
  topK: number,
  minSimilarity: number,
): Promise<{ chunks: RetrievedChunk[]; retrievalMs: number }> {
  const startedAt = performance.now();
  const collection = await getRulesCollection();
  const totalCount = await collection.count();

  if (totalCount === 0) {
    return { chunks: [], retrievalMs: Math.round(performance.now() - startedAt) };
  }

  const [queryEmbedding] = await embedTexts([query]);
  const nResults = Math.max(1, Math.min(topK, totalCount));

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults,
    include: ['documents', 'metadatas', 'distances'],
  });

  const ids = results.ids[0] ?? [];
  const documents = results.documents[0] ?? [];
  const metadatas = results.metadatas[0] ?? [];
  const distances = results.distances[0] ?? [];

  const chunks: RetrievedChunk[] = [];
  for (let i = 0; i < ids.length; i++) {
    const distance = typeof distances[i] === 'number' ? distances[i]! : 1;
    // Chroma cosine distance = 1 - cosine_similarity, in [0, 2]
    const similarity = Math.max(0, Math.min(1, 1 - distance));
    if (similarity < minSimilarity) continue;

    const meta = (metadatas[i] || {}) as Record<string, unknown>;
    chunks.push({
      id: ids[i],
      title: typeof meta.title === 'string' ? meta.title : ids[i],
      category: typeof meta.category === 'string' ? meta.category : 'General',
      content: typeof meta.content === 'string' ? meta.content : documents[i] || '',
      distance: Number(distance.toFixed(4)),
      similarity: Number(similarity.toFixed(4)),
    });
  }

  chunks.sort((a, b) => b.similarity - a.similarity);

  return {
    chunks,
    retrievalMs: Math.round(performance.now() - startedAt),
  };
}

export async function checkChromaHealth() {
  const url = `http://${config.chromaHost}:${config.chromaPort}`;
  try {
    await chromaClient.heartbeat();
    const collection = await getRulesCollection();
    const indexedCount = await collection.count();
    return {
      connected: true,
      url,
      collection: config.chromaCollection,
      indexedCount,
    };
  } catch (err) {
    return {
      connected: false,
      url,
      collection: config.chromaCollection,
      indexedCount: 0,
      error: err instanceof Error ? err.message : 'Unable to reach Chroma DB',
    };
  }
}
