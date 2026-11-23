import { Router } from 'express';
import { checkChromaHealth } from '../services/chroma.js';
import { checkOllamaHealth } from '../services/ollama.js';
import { listRules } from '../services/ruleStore.js';
import type { HealthStatus } from '../types.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const [ollama, chroma, rules] = await Promise.all([
    checkOllamaHealth(),
    checkChromaHealth(),
    listRules(),
  ]);

  const healthy =
    ollama.connected && ollama.llmAvailable && ollama.embedAvailable && chroma.connected;

  const payload: HealthStatus = {
    status: healthy ? 'ok' : 'degraded',
    ollama,
    chroma,
    rulesCount: rules.length,
  };

  res.json(payload);
});
