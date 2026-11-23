import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRuleApi,
  deleteRuleApi,
  fetchHealth,
  fetchRules,
  generateRuleApi,
  reindexRulesApi,
  resetRulesApi,
  streamQueryApi,
  updateRuleApi,
} from './api';
import { AskConcierge } from './components/AskConcierge';
import { Header, type ActiveTab } from './components/Header';
import { RulesManager } from './components/RulesManager';
import type {
  ComparisonState,
  HealthStatus,
  HotelRule,
  RuleCategory,
  SampleQuestion,
} from './types';

const INITIAL_COMPARISON: ComparisonState = {
  question: '',
  executionMode: 'sequential',
  directStatus: 'idle',
  directText: '',
  directStats: null,
  directError: null,
  ragStatus: 'idle',
  ragText: '',
  ragStats: null,
  ragError: null,
  retrieval: null,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('concierge');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [rules, setRules] = useState<HotelRule[]>([]);
  const [categories, setCategories] = useState<RuleCategory[]>([]);
  const [sampleQuestions, setSampleQuestions] = useState<SampleQuestion[]>([]);

  const [questionInput, setQuestionInput] = useState('');
  const [topK, setTopK] = useState(3);
  const [minSimilarity, setMinSimilarity] = useState(0.25);
  const [parallel, setParallel] = useState(false);

  const [comparison, setComparison] = useState<ComparisonState>(INITIAL_COMPARISON);
  const [isRunning, setIsRunning] = useState(false);
  const [rulesDirtySinceLastRun, setRulesDirtySinceLastRun] = useState(false);

  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((kind: 'success' | 'error', message: string) => {
    setToast({ kind, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [rulesData, healthData] = await Promise.all([fetchRules(), fetchHealth()]);
      setRules(rulesData.rules);
      setCategories(rulesData.categories);
      setSampleQuestions(rulesData.sampleQuestions);
      setHealth(healthData);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to connect to local server');
    }
  }, [showToast]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const handleSubmitQuestion = async (question: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setRulesDirtySinceLastRun(false);
    setComparison({
      question,
      executionMode: parallel ? 'parallel' : 'sequential',
      directStatus: 'streaming',
      directText: '',
      directStats: null,
      directError: null,
      ragStatus: parallel ? 'retrieving' : 'queued',
      ragText: '',
      ragStats: null,
      ragError: null,
      retrieval: null,
    });

    try {
      await streamQueryApi(
        { question, topK, minSimilarity, parallel },
        {
          onDirectStart: () => {
            setComparison((prev) => ({ ...prev, directStatus: 'streaming' }));
          },
          onDirectToken: (token) => {
            setComparison((prev) => ({ ...prev, directText: prev.directText + token }));
          },
          onDirectDone: ({ text, stats }) => {
            setComparison((prev) => ({
              ...prev,
              directStatus: 'done',
              directText: text || prev.directText,
              directStats: stats,
            }));
          },
          onDirectError: (error) => {
            setComparison((prev) => ({ ...prev, directStatus: 'error', directError: error }));
          },
          onRagStart: () => {
            setComparison((prev) => ({ ...prev, ragStatus: 'retrieving' }));
          },
          onRagRetrieval: (retrieval) => {
            setComparison((prev) => ({
              ...prev,
              retrieval,
              ragStatus: 'streaming',
            }));
          },
          onRagToken: (token) => {
            setComparison((prev) => ({ ...prev, ragText: prev.ragText + token }));
          },
          onRagDone: ({ text, stats }) => {
            setComparison((prev) => ({
              ...prev,
              ragStatus: 'done',
              ragText: text || prev.ragText,
              ragStats: stats,
            }));
          },
          onRagError: (error) => {
            setComparison((prev) => ({ ...prev, ragStatus: 'error', ragError: error }));
          },
        },
        controller.signal,
      );
      void refreshHealth();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'Query stream failed';
        showToast('error', msg);
        setComparison((prev) => ({
          ...prev,
          directStatus: prev.directStatus === 'done' ? 'done' : 'error',
          directError: prev.directStatus === 'done' ? null : msg,
          ragStatus: prev.ragStatus === 'done' ? 'done' : 'error',
          ragError: prev.ragStatus === 'done' ? null : msg,
        }));
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setComparison((prev) => ({
      ...prev,
      directStatus: prev.directStatus === 'streaming' ? 'done' : prev.directStatus,
      ragStatus:
        prev.ragStatus === 'streaming' || prev.ragStatus === 'queued' || prev.ragStatus === 'retrieving'
          ? 'idle'
          : prev.ragStatus,
    }));
  };

  const handleCreateRule = async (data: {
    title: string;
    category: RuleCategory;
    content: string;
  }) => {
    try {
      const created = await createRuleApi(data);
      setRules((prev) => [created, ...prev]);
      setRulesDirtySinceLastRun(true);
      showToast('success', `Added "${created.title}" & embedded in Chroma DB`);
      void refreshHealth();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create rule');
      throw err;
    }
  };

  const handleUpdateRule = async (
    id: string,
    data: { title: string; category: RuleCategory; content: string },
  ) => {
    try {
      const updated = await updateRuleApi(id, data);
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setRulesDirtySinceLastRun(true);
      showToast('success', `Updated "${updated.title}" & re-embedded in Chroma DB`);
      void refreshHealth();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update rule');
      throw err;
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRuleApi(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      setRulesDirtySinceLastRun(true);
      showToast('success', 'Rule deleted from storage & Chroma DB');
      void refreshHealth();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete rule');
      throw err;
    }
  };

  const handleResetRules = async () => {
    try {
      const fresh = await resetRulesApi();
      setRules(fresh);
      setRulesDirtySinceLastRun(true);
      showToast('success', `Reset to ${fresh.length} default rules & rebuilt Chroma index`);
      void refreshHealth();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to reset rules');
      throw err;
    }
  };

  const handleReindexRules = async () => {
    try {
      const count = await reindexRulesApi();
      showToast('success', `Re-embedded ${count} hotel rules in Chroma DB`);
      void refreshHealth();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to re-index Chroma DB');
    }
  };

  const handleGenerateRule = async (topic?: string) => {
    try {
      const created = await generateRuleApi(topic);
      setRules((prev) => [created, ...prev]);
      setRulesDirtySinceLastRun(true);
      showToast('success', `Gemma generated & embedded "${created.title}"`);
      void refreshHealth();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to generate rule with Gemma');
    }
  };

  const degradedWarning =
    health && health.status !== 'ok'
      ? [
          !health.ollama.connected && `Ollama unreachable at ${health.ollama.baseUrl}`,
          health.ollama.connected &&
            !health.ollama.llmAvailable &&
            `Model "${health.ollama.llmModel}" not found in Ollama`,
          health.ollama.connected &&
            !health.ollama.embedAvailable &&
            `Embedding model "${health.ollama.embedModel}" not found in Ollama`,
          !health.chroma.connected && `Chroma DB unreachable at ${health.chroma.url}`,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <div className="app-shell">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        health={health}
        rulesCount={rules.length}
        onRefreshHealth={() => void refreshHealth()}
      />

      {degradedWarning && (
        <div className="banner banner-warn" role="status">
          <span>
            <strong>Service check:</strong> {degradedWarning}
          </span>
          <button type="button" className="btn btn-sm" onClick={() => void refreshHealth()}>
            Retry Check
          </button>
        </div>
      )}

      <main>
        {activeTab === 'concierge' ? (
          <AskConcierge
            questionInput={questionInput}
            onQuestionInputChange={setQuestionInput}
            sampleQuestions={sampleQuestions}
            topK={topK}
            onTopKChange={setTopK}
            minSimilarity={minSimilarity}
            onMinSimilarityChange={setMinSimilarity}
            parallel={parallel}
            onParallelChange={setParallel}
            isRunning={isRunning}
            comparison={comparison}
            rulesDirtySinceLastRun={rulesDirtySinceLastRun}
            health={health}
            onSubmitQuestion={(q) => void handleSubmitQuestion(q)}
            onStop={handleStop}
          />
        ) : (
          <RulesManager
            rules={rules}
            categories={categories}
            onCreateRule={handleCreateRule}
            onUpdateRule={handleUpdateRule}
            onDeleteRule={handleDeleteRule}
            onResetRules={handleResetRules}
            onReindexRules={handleReindexRules}
            onGenerateRule={handleGenerateRule}
          />
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
