import type { FormEvent } from 'react';
import type { ComparisonState, HealthStatus, SampleQuestion } from '../types';
import { ResponseCard } from './ResponseCard';

interface AskConciergeProps {
  questionInput: string;
  onQuestionInputChange: (val: string) => void;
  sampleQuestions: SampleQuestion[];
  topK: number;
  onTopKChange: (val: number) => void;
  minSimilarity: number;
  onMinSimilarityChange: (val: number) => void;
  parallel: boolean;
  onParallelChange: (val: boolean) => void;
  isRunning: boolean;
  comparison: ComparisonState;
  rulesDirtySinceLastRun: boolean;
  health: HealthStatus | null;
  onSubmitQuestion: (question: string) => void;
  onStop: () => void;
}

export function AskConcierge({
  questionInput,
  onQuestionInputChange,
  sampleQuestions,
  topK,
  onTopKChange,
  minSimilarity,
  onMinSimilarityChange,
  parallel,
  onParallelChange,
  isRunning,
  comparison,
  rulesDirtySinceLastRun,
  health,
  onSubmitQuestion,
  onStop,
}: AskConciergeProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim() || isRunning) return;
    onSubmitQuestion(questionInput.trim());
  };

  const llmModel = health?.ollama.llmModel ?? 'gemma4:e2b';
  const embedModel = health?.ollama.embedModel ?? 'embeddinggemma-2:270m';

  return (
    <div id="panel-concierge" role="tabpanel" aria-labelledby="tab-concierge">
      {rulesDirtySinceLastRun && comparison.question && (
        <div className="banner banner-rag">
          <span>
            Hotel rules were modified and re-embedded in Chroma DB. Re-run{' '}
            <strong>&ldquo;{comparison.question}&rdquo;</strong> to see the updated RAG reply.
          </span>
          <button
            type="button"
            className="btn btn-rag btn-sm"
            disabled={isRunning}
            onClick={() => onSubmitQuestion(comparison.question)}
          >
            Re-run Question
          </button>
        </div>
      )}

      <div className="composer-card">
        <form className="composer-form" onSubmit={handleSubmit}>
          <label htmlFor="guest-question" className="visually-hidden">
            Ask a question about staying at the Grand Aurora Hotel
          </label>
          <input
            id="guest-question"
            type="text"
            className="composer-input"
            placeholder="Ask about your hotel stay (e.g. What time is breakfast served?)"
            value={questionInput}
            onChange={(e) => onQuestionInputChange(e.target.value)}
            disabled={isRunning}
          />
          {isRunning ? (
            <button type="button" className="btn btn-danger" onClick={onStop}>
              Stop
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!questionInput.trim()}
            >
              Ask Both Models
            </button>
          )}
        </form>

        <div className="samples-row" aria-label="Sample hotel questions">
          <span className="samples-label">Try:</span>
          {sampleQuestions.map((item) => (
            <button
              key={item.label}
              type="button"
              className="sample-chip"
              disabled={isRunning}
              onClick={() => {
                onQuestionInputChange(item.question);
                onSubmitQuestion(item.question);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="controls-bar">
          <div className="slider-control">
            <label htmlFor="topk-slider">Top-K Rules</label>
            <input
              id="topk-slider"
              type="range"
              min={1}
              max={6}
              step={1}
              value={topK}
              onChange={(e) => onTopKChange(Number(e.target.value))}
            />
            <output htmlFor="topk-slider">{topK}</output>
          </div>

          <div className="slider-control">
            <label htmlFor="sim-slider">Min Similarity</label>
            <input
              id="sim-slider"
              type="range"
              min={0}
              max={75}
              step={5}
              value={Math.round(minSimilarity * 100)}
              onChange={(e) => onMinSimilarityChange(Number(e.target.value) / 100)}
            />
            <output htmlFor="sim-slider">{Math.round(minSimilarity * 100)}%</output>
          </div>

          <label className="checkbox-control" htmlFor="parallel-toggle">
            <input
              id="parallel-toggle"
              type="checkbox"
              checked={parallel}
              onChange={(e) => onParallelChange(e.target.checked)}
            />
            <span>Run in parallel</span>
            <span className="vram-note">
              {parallel ? 'Higher VRAM' : 'Sequential · 4 GB VRAM safe'}
            </span>
          </label>
        </div>
      </div>

      <div className="comparison-grid">
        <ResponseCard
          variant="direct"
          modelName={llmModel}
          status={comparison.directStatus}
          text={comparison.directText}
          stats={comparison.directStats}
          error={comparison.directError}
        />

        <ResponseCard
          variant="rag"
          modelName={llmModel}
          embedModelName={embedModel}
          status={comparison.ragStatus}
          text={comparison.ragText}
          stats={comparison.ragStats}
          error={comparison.ragError}
          retrieval={comparison.retrieval}
        />
      </div>
    </div>
  );
}
