import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

function parseNum(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
  llmModel: process.env.LLM_MODEL || 'gemma4:e2b',
  embedModel: process.env.EMBED_MODEL || 'embeddinggemma-2:270m',
  ollamaNumCtx: parseNum(process.env.OLLAMA_NUM_CTX, 4096),
  ollamaThink: parseBool(process.env.OLLAMA_THINK, false),
  ollamaTemperature: parseNum(process.env.OLLAMA_TEMPERATURE, 0.2),
  chromaHost: process.env.CHROMA_HOST || '127.0.0.1',
  chromaPort: parseNum(process.env.CHROMA_PORT, 8000),
  chromaCollection: process.env.CHROMA_COLLECTION || 'grand_aurora_hotel_rules',
  serverPort: parseNum(process.env.SERVER_PORT, 3001),
  dataDir: path.join(ROOT_DIR, 'data'),
  rulesFilePath: path.join(ROOT_DIR, 'data', 'rules.json'),
} as const;
