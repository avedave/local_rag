import { Router, type Response } from 'express';
import { config } from '../config.js';
import { HOTEL_NAME } from '../data/defaultRules.js';
import { searchRulesInChroma } from '../services/chroma.js';
import { streamChat, type ChatMessage } from '../services/ollama.js';
import type { RetrievalPayload, RetrievedChunk } from '../types.js';

export const queryRouter = Router();

const SHARED_CONCIERGE_ROLE = `You are the friendly, concise front-desk concierge at the ${HOTEL_NAME}. Answer guest questions clearly and politely in 2-4 sentences.`;

function buildDirectMessages(question: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `${SHARED_CONCIERGE_ROLE} Answer directly from your own knowledge without inventing unverified policies.`,
    },
    {
      role: 'user',
      content: question,
    },
  ];
}

function buildRagPrompts(question: string, chunks: RetrievedChunk[]) {
  const systemPrompt = `${SHARED_CONCIERGE_ROLE} Use ONLY the official ${HOTEL_NAME} rules retrieved below to answer the guest's question. Quote exact hours, floors, prices, or names from the rules when relevant. If the retrieved rules do not cover the question, politely say you do not have that specific policy on file and offer to check with the front desk.`;

  const contextBlock =
    chunks.length > 0
      ? chunks
          .map(
            (chunk, index) =>
              `[Rule ${index + 1} | ${chunk.category} — ${chunk.title} | Match: ${Math.round(chunk.similarity * 100)}%]\n${chunk.content}`,
          )
          .join('\n\n')
      : '(No hotel rules matched the similarity threshold.)';

  const userPrompt = `Retrieved Official Hotel Rules:\n${contextBlock}\n\nGuest Question:\n${question}`;

  return {
    systemPrompt,
    userPrompt,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ] satisfies ChatMessage[],
  };
}

function writeSse(res: Response, event: string, data: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

queryRouter.post('/', async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const topK = Math.max(1, Math.min(8, Number(req.body?.topK) || 3));
  const minSimilarity = Math.max(0, Math.min(0.95, Number(req.body?.minSimilarity ?? 0.25)));
  const parallel = Boolean(req.body?.parallel);

  if (!question) {
    res.status(400).json({ error: 'Please enter a question about your hotel stay.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  writeSse(res, 'meta', {
    question,
    llmModel: config.llmModel,
    embedModel: config.embedModel,
    executionMode: parallel ? 'parallel' : 'sequential',
    topK,
    minSimilarity,
  });

  const runDirect = async () => {
    writeSse(res, 'direct_start', {});
    try {
      const result = await streamChat(
        buildDirectMessages(question),
        (token) => writeSse(res, 'direct_token', { token }),
        abortController.signal,
      );
      writeSse(res, 'direct_done', { text: result.text, stats: result.stats });
    } catch (err) {
      if (abortController.signal.aborted) return;
      writeSse(res, 'direct_error', {
        error: err instanceof Error ? err.message : 'Direct generation failed',
      });
    }
  };

  const runRag = async () => {
    writeSse(res, 'rag_start', {});
    try {
      const { chunks, retrievalMs } = await searchRulesInChroma(question, topK, minSimilarity);
      const { systemPrompt, userPrompt, messages } = buildRagPrompts(question, chunks);

      const retrievalPayload: RetrievalPayload = {
        chunks,
        retrievalMs,
        topK,
        minSimilarity,
        augmentedSystemPrompt: systemPrompt,
        augmentedUserPrompt: userPrompt,
      };
      writeSse(res, 'rag_retrieval', retrievalPayload);

      const result = await streamChat(
        messages,
        (token) => writeSse(res, 'rag_token', { token }),
        abortController.signal,
      );
      writeSse(res, 'rag_done', { text: result.text, stats: result.stats });
    } catch (err) {
      if (abortController.signal.aborted) return;
      writeSse(res, 'rag_error', {
        error: err instanceof Error ? err.message : 'RAG generation failed',
      });
    }
  };

  try {
    if (parallel) {
      await Promise.all([runDirect(), runRag()]);
    } else {
      // Sequential by default: fits comfortably within a single-slot 4GB VRAM GPU budget
      await runDirect();
      if (!abortController.signal.aborted) {
        await runRag();
      }
    }
    writeSse(res, 'done', {});
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});
