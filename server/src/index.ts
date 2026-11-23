import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { config, ROOT_DIR } from './config.js';
import { healthRouter } from './routes/health.js';
import { queryRouter } from './routes/query.js';
import { rulesRouter } from './routes/rules.js';
import { initializeKnowledgeBase } from './services/ruleStore.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/query', queryRouter);

// Serve built React frontend in production (`npm run build && npm start`)
const clientDistDir = path.join(ROOT_DIR, 'client', 'dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

app.listen(config.serverPort, '127.0.0.1', () => {
  console.log(
    `[server] Local RAG orchestrator listening on http://127.0.0.1:${config.serverPort}`,
  );
  console.log(
    `[server] LLM: ${config.llmModel} (think=${config.ollamaThink}, num_ctx=${config.ollamaNumCtx}) | Embeddings: ${config.embedModel}`,
  );
  void initializeKnowledgeBase();
});
