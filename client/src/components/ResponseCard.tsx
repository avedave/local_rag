import type { InferenceStats, PanelStatus, RetrievalPayload } from '../types';

interface ResponseCardProps {
  variant: 'direct' | 'rag';
  modelName: string;
  embedModelName?: string;
  status: PanelStatus;
  text: string;
  stats: InferenceStats | null;
  error: string | null;
  retrieval?: RetrievalPayload | null;
}

function statusLabel(status: PanelStatus, variant: 'direct' | 'rag'): string {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'queued':
      return 'Queued (4GB VRAM safe)';
    case 'retrieving':
      return 'Embedding & searching Chroma…';
    case 'streaming':
      return 'Generating…';
    case 'done':
      return variant === 'rag' ? 'Grounded reply' : 'Direct reply';
    case 'error':
      return 'Error';
  }
}

export function ResponseCard({
  variant,
  modelName,
  embedModelName,
  status,
  text,
  stats,
  error,
  retrieval,
}: ResponseCardProps) {
  const isRag = variant === 'rag';

  return (
    <section
      className={`response-card ${isRag ? 'rag-card' : ''}`}
      aria-label={isRag ? 'RAG-enabled model response' : 'Direct model response without RAG'}
    >
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">
            {isRag ? 'RAG-Enabled Model' : 'Direct Model (No RAG)'}
          </h2>
          <span className="card-subtitle">
            {isRag
              ? `${modelName} + ${embedModelName ?? 'embeddinggemma-2:270m'} + Chroma DB`
              : `${modelName} · No hotel documents provided`}
          </span>
        </div>

        <span className={`badge ${isRag ? 'badge-rag' : 'badge-direct'}`}>
          {statusLabel(status, variant)}
        </span>
      </div>

      <div className="card-body">
        {error ? (
          <div className="error-box" role="alert">
            {error}
          </div>
        ) : status === 'idle' ? (
          <div className="empty-state">
            {isRag
              ? 'Ask a hotel question above to retrieve matching rules from Chroma DB and inject them into the prompt.'
              : 'Ask a hotel question above to see how the base model answers without access to hotel policies.'}
          </div>
        ) : status === 'queued' ? (
          <div className="empty-state">
            Waiting for Direct generation to finish before running RAG (keeps single-slot VRAM under 4 GB)…
          </div>
        ) : status === 'retrieving' && !text ? (
          <div className="empty-state">
            Embedding query with {embedModelName ?? 'embeddinggemma-2:270m'} and querying Chroma DB…
          </div>
        ) : (
          <div className="answer-box" aria-live="polite">
            {text || (status === 'streaming' ? '' : 'No text returned.')}
            {status === 'streaming' && <span className="cursor-blink" aria-hidden="true" />}
          </div>
        )}

        {isRag && retrieval && (
          <div className="retrieval-section">
            <div className="retrieval-header">
              <span>
                Retrieved Hotel Rules ({retrieval.chunks.length} of top-{retrieval.topK})
              </span>
              <span>Search: {retrieval.retrievalMs} ms</span>
            </div>

            {retrieval.chunks.length === 0 ? (
              <p className="chunk-content">
                No rules exceeded the {Math.round(retrieval.minSimilarity * 100)}% similarity
                threshold. Try lowering the minimum similarity slider or adding a matching rule.
              </p>
            ) : (
              <div className="chunk-list">
                {retrieval.chunks.map((chunk) => {
                  const pct = Math.round(chunk.similarity * 100);
                  return (
                    <article key={chunk.id} className="chunk-item">
                      <div className="chunk-top">
                        <div>
                          <span className="chunk-title">{chunk.title}</span>
                          <span className="chunk-cat">{chunk.category}</span>
                        </div>
                        <span className="score-pill" title={`Cosine distance: ${chunk.distance}`}>
                          {pct}% match
                        </span>
                      </div>
                      <div className="score-bar-track" aria-hidden="true">
                        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="chunk-content">{chunk.content}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isRag && retrieval && (
          <details className="prompt-details">
            <summary>Inspect Augmented Prompt sent to {modelName}</summary>
            <div className="prompt-inspector-body">
              <div>
                <div className="prompt-block-label">System Prompt</div>
                <pre className="prompt-code">{retrieval.augmentedSystemPrompt}</pre>
              </div>
              <div>
                <div className="prompt-block-label">Augmented User Prompt</div>
                <pre className="prompt-code">{retrieval.augmentedUserPrompt}</pre>
              </div>
            </div>
          </details>
        )}
      </div>

      {stats && (
        <div className="stats-footer" aria-label="Inference metrics">
          <span>Total: {(stats.totalMs / 1000).toFixed(2)}s</span>
          {stats.firstTokenMs !== null && <span>TTFT: {stats.firstTokenMs}ms</span>}
          <span>Prompt: {stats.promptTokens} tok</span>
          <span>Output: {stats.completionTokens} tok</span>
          {stats.tokensPerSec > 0 && <span>{stats.tokensPerSec} tok/s</span>}
        </div>
      )}
    </section>
  );
}
