import type { HealthStatus } from '../types';

export type ActiveTab = 'concierge' | 'rules';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  health: HealthStatus | null;
  rulesCount: number;
  onRefreshHealth: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  health,
  rulesCount,
  onRefreshHealth,
}: HeaderProps) {
  const ollamaDot = !health
    ? ''
    : health.ollama.connected && health.ollama.llmAvailable && health.ollama.embedAvailable
      ? 'ok'
      : health.ollama.connected
        ? 'warn'
        : 'err';

  const chromaDot = !health ? '' : health.chroma.connected ? 'ok' : 'err';

  const loadedVramMb =
    health?.ollama.loadedModels.reduce((sum, m) => sum + m.sizeVramMb, 0) ?? 0;

  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand-block">
          <div className="brand-crest" aria-hidden="true">
            GA
          </div>
          <div>
            <h1 className="brand-title">Grand Aurora Hotel · Local RAG Demonstrator</h1>
            <p className="brand-subtitle">
              Compare raw open-weight inference against Chroma DB + EmbeddingGemma 2 retrieval
            </p>
          </div>
        </div>

        <div className="status-bar" aria-label="Local service health">
          <span
            className="status-pill"
            title={
              health?.ollama.error ||
              `Ollama at ${health?.ollama.baseUrl ?? '...'} (ctx=${health?.ollama.numCtx ?? 4096}, think=${health?.ollama.thinkDefault ?? false})`
            }
          >
            <span className={`status-dot ${ollamaDot}`} aria-hidden="true" />
            LLM: <strong>{health?.ollama.llmModel ?? 'gemma4:e2b'}</strong>
          </span>

          <span className="status-pill" title="Local embedding model via Ollama /api/embed">
            <span
              className={`status-dot ${health?.ollama.embedAvailable ? 'ok' : ollamaDot}`}
              aria-hidden="true"
            />
            Embed: <strong>{health?.ollama.embedModel ?? 'embeddinggemma-2:270m'}</strong>
          </span>

          <span
            className="status-pill"
            title={health?.chroma.error || `Chroma DB at ${health?.chroma.url ?? '...'}`}
          >
            <span className={`status-dot ${chromaDot}`} aria-hidden="true" />
            Chroma: <strong>{health?.chroma.indexedCount ?? 0}</strong> vectors
          </span>

          {loadedVramMb > 0 && (
            <span className="status-pill" title="Currently loaded in Ollama VRAM">
              VRAM: <strong>{(loadedVramMb / 1024).toFixed(1)} GB</strong>
            </span>
          )}

          <button
            type="button"
            className="btn btn-icon"
            onClick={onRefreshHealth}
            title="Refresh Ollama & Chroma status"
            aria-label="Refresh system health"
          >
            ↻
          </button>
        </div>
      </div>

      <nav className="tabs-nav" role="tablist" aria-label="Workspace sections">
        <button
          type="button"
          role="tab"
          id="tab-concierge"
          aria-selected={activeTab === 'concierge'}
          aria-controls="panel-concierge"
          className="tab-btn"
          onClick={() => onTabChange('concierge')}
        >
          Ask Concierge (Direct vs. RAG)
        </button>

        <button
          type="button"
          role="tab"
          id="tab-rules"
          aria-selected={activeTab === 'rules'}
          aria-controls="panel-rules"
          className="tab-btn"
          onClick={() => onTabChange('rules')}
        >
          Hotel Rules Manager
          <span className="tab-count">{rulesCount}</span>
        </button>
      </nav>
    </header>
  );
}
