import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { DEFAULT_RULES } from '../data/defaultRules.js';
import type { HotelRule, RuleCategory } from '../types.js';
import {
  checkChromaHealth,
  deleteRuleFromChroma,
  resetChromaCollection,
  upsertRulesInChroma,
} from './chroma.js';

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true });
}

export async function loadRulesFromDisk(): Promise<HotelRule[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(config.rulesFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as HotelRule[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // First boot: seed default rules
  }

  const seeded = DEFAULT_RULES.map((rule) => ({
    ...rule,
    updatedAt: new Date().toISOString(),
  }));
  await saveRulesToDisk(seeded);
  return seeded;
}

export async function saveRulesToDisk(rules: HotelRule[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(config.rulesFilePath, JSON.stringify(rules, null, 2), 'utf-8');
}

export async function initializeKnowledgeBase(): Promise<void> {
  const rules = await loadRulesFromDisk();

  // Wait up to ~20s for Chroma DB when started concurrently via `npm run dev`
  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const health = await checkChromaHealth();
    if (health.connected) {
      if (health.indexedCount !== rules.length) {
        console.log(
          `[rag] Syncing ${rules.length} hotel rules into Chroma DB (currently indexed: ${health.indexedCount})...`,
        );
        await resetChromaCollection(rules);
        console.log(`[rag] Indexed ${rules.length} hotel rules using ${config.embedModel}.`);
      } else {
        console.log(
          `[rag] Chroma DB ready with ${health.indexedCount} indexed hotel rules.`,
        );
      }
      return;
    }
    if (attempt === 1) {
      console.log(`[rag] Waiting for local Chroma DB at ${health.url}...`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.warn(
    `[rag] Chroma DB did not respond within ${maxAttempts}s. Rules are saved locally; use "Re-index" once Chroma is running.`,
  );
}

export async function listRules(): Promise<HotelRule[]> {
  return loadRulesFromDisk();
}

export async function createRule(input: {
  title: string;
  category: RuleCategory;
  content: string;
}): Promise<HotelRule> {
  const rules = await loadRulesFromDisk();
  const rule: HotelRule = {
    id: `rule-${crypto.randomUUID().slice(0, 8)}`,
    title: input.title.trim(),
    category: input.category,
    content: input.content.trim(),
    updatedAt: new Date().toISOString(),
  };

  await upsertRulesInChroma([rule]);
  rules.unshift(rule);
  await saveRulesToDisk(rules);
  return rule;
}

export async function updateRule(
  id: string,
  input: { title: string; category: RuleCategory; content: string },
): Promise<HotelRule | null> {
  const rules = await loadRulesFromDisk();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const updated: HotelRule = {
    ...rules[idx],
    title: input.title.trim(),
    category: input.category,
    content: input.content.trim(),
    updatedAt: new Date().toISOString(),
  };

  await upsertRulesInChroma([updated]);
  rules[idx] = updated;
  await saveRulesToDisk(rules);
  return updated;
}

export async function removeRule(id: string): Promise<boolean> {
  const rules = await loadRulesFromDisk();
  const filtered = rules.filter((r) => r.id !== id);
  if (filtered.length === rules.length) return false;

  await deleteRuleFromChroma(id);
  await saveRulesToDisk(filtered);
  return true;
}

export async function resetRulesToDefaults(): Promise<HotelRule[]> {
  const fresh = DEFAULT_RULES.map((rule) => ({
    ...rule,
    updatedAt: new Date().toISOString(),
  }));
  await resetChromaCollection(fresh);
  await saveRulesToDisk(fresh);
  return fresh;
}

export async function reindexAllRules(): Promise<number> {
  const rules = await loadRulesFromDisk();
  await resetChromaCollection(rules);
  return rules.length;
}
