import { Router } from 'express';
import { SAMPLE_QUESTIONS } from '../data/defaultRules.js';
import { generateHotelRule } from '../services/ollama.js';
import {
  createRule,
  listRules,
  reindexAllRules,
  removeRule,
  resetRulesToDefaults,
  updateRule,
} from '../services/ruleStore.js';
import { RULE_CATEGORIES, type RuleCategory } from '../types.js';

export const rulesRouter = Router();

function isValidCategory(value: unknown): value is RuleCategory {
  return typeof value === 'string' && (RULE_CATEGORIES as readonly string[]).includes(value);
}

rulesRouter.get('/', async (_req, res) => {
  try {
    const rules = await listRules();
    res.json({
      rules,
      categories: RULE_CATEGORIES,
      sampleQuestions: SAMPLE_QUESTIONS,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list rules' });
  }
});

rulesRouter.post('/', async (req, res) => {
  try {
    const { title, category, content } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length < 3) {
      res.status(400).json({ error: 'Title must be at least 3 characters.' });
      return;
    }
    if (!isValidCategory(category)) {
      res.status(400).json({ error: 'Invalid category.' });
      return;
    }
    if (typeof content !== 'string' || content.trim().length < 10) {
      res.status(400).json({ error: 'Rule content must be at least 10 characters.' });
      return;
    }

    const created = await createRule({ title, category, content });
    res.status(201).json({ rule: created });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create rule' });
  }
});

rulesRouter.put('/:id', async (req, res) => {
  try {
    const { title, category, content } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length < 3) {
      res.status(400).json({ error: 'Title must be at least 3 characters.' });
      return;
    }
    if (!isValidCategory(category)) {
      res.status(400).json({ error: 'Invalid category.' });
      return;
    }
    if (typeof content !== 'string' || content.trim().length < 10) {
      res.status(400).json({ error: 'Rule content must be at least 10 characters.' });
      return;
    }

    const updated = await updateRule(req.params.id, { title, category, content });
    if (!updated) {
      res.status(404).json({ error: 'Rule not found.' });
      return;
    }
    res.json({ rule: updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update rule' });
  }
});

rulesRouter.delete('/:id', async (req, res) => {
  try {
    const deleted = await removeRule(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Rule not found.' });
      return;
    }
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete rule' });
  }
});

rulesRouter.post('/reset', async (_req, res) => {
  try {
    const rules = await resetRulesToDefaults();
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to reset rules' });
  }
});

rulesRouter.post('/reindex', async (_req, res) => {
  try {
    const indexedCount = await reindexAllRules();
    res.json({ indexedCount });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to re-index rules' });
  }
});

rulesRouter.post('/generate', async (req, res) => {
  try {
    const topicHint = typeof req.body?.topic === 'string' ? req.body.topic : undefined;
    const existing = await listRules();
    const draft = await generateHotelRule(existing, topicHint);
    const created = await createRule(draft);
    res.status(201).json({ rule: created });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate rule' });
  }
});
