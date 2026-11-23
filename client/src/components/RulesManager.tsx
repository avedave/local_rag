import { useMemo, useState } from 'react';
import type { HotelRule, RuleCategory } from '../types';
import { ConfirmModal, RuleModal } from './RuleModal';

interface RulesManagerProps {
  rules: HotelRule[];
  categories: RuleCategory[];
  onCreateRule: (data: { title: string; category: RuleCategory; content: string }) => Promise<void>;
  onUpdateRule: (
    id: string,
    data: { title: string; category: RuleCategory; content: string },
  ) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onResetRules: () => Promise<void>;
  onReindexRules: () => Promise<void>;
  onGenerateRule: (topic?: string) => Promise<void>;
}

export function RulesManager({
  rules,
  categories,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  onResetRules,
  onReindexRules,
  onGenerateRule,
}: RulesManagerProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<HotelRule | null>(null);
  const [saving, setSaving] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<HotelRule | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (selectedCategory !== 'All' && r.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [rules, search, selectedCategory]);

  const handleSave = async (data: { title: string; category: RuleCategory; content: string }) => {
    setSaving(true);
    try {
      if (editingRule) {
        await onUpdateRule(editingRule.id, data);
      } else {
        await onCreateRule(data);
      }
      setModalOpen(false);
      setEditingRule(null);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerateRule();
    } finally {
      setGenerating(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await onReindexRules();
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div id="panel-rules" role="tabpanel" aria-labelledby="tab-rules">
      <div className="rules-toolbar">
        <div className="rules-search-group">
          <label htmlFor="rules-search" className="visually-hidden">
            Search hotel rules
          </label>
          <input
            id="rules-search"
            type="search"
            className="search-input"
            placeholder="Filter hotel rules by keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rules-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingRule(null);
              setModalOpen(true);
            }}
          >
            + Add Rule
          </button>

          <button
            type="button"
            className="btn"
            disabled={generating}
            onClick={() => void handleGenerate()}
            title="Ask local Gemma 4 to author a new hotel policy and embed it in Chroma DB"
          >
            {generating ? 'Generating with Gemma…' : '✦ Generate Rule with Gemma'}
          </button>

          <button
            type="button"
            className="btn"
            disabled={reindexing}
            onClick={() => void handleReindex()}
            title="Rebuild all embeddings in Chroma DB from local rules.json"
          >
            {reindexing ? 'Re-indexing…' : 'Re-index Chroma'}
          </button>

          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmResetOpen(true)}
          >
            Reset Defaults
          </button>
        </div>
      </div>

      <div className="category-pills" role="group" aria-label="Filter by category">
        <button
          type="button"
          className="cat-pill"
          aria-pressed={selectedCategory === 'All'}
          onClick={() => setSelectedCategory('All')}
        >
          All ({rules.length})
        </button>
        {categories.map((cat) => {
          const count = rules.filter((r) => r.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              className="cat-pill"
              aria-pressed={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {filteredRules.length === 0 ? (
        <div className="banner">
          <span>No hotel rules match your current filter.</span>
        </div>
      ) : (
        <div className="rules-grid">
          {filteredRules.map((rule) => (
            <article key={rule.id} className="rule-card">
              <div className="rule-card-top">
                <span className="rule-category-tag">{rule.category}</span>
              </div>
              <h2 className="rule-card-title">{rule.title}</h2>
              <p className="rule-card-content">{rule.content}</p>
              <div className="rule-card-footer">
                <span>Updated {new Date(rule.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <div className="rule-card-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setEditingRule(rule);
                      setModalOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setPendingDelete(rule)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <RuleModal
        open={modalOpen}
        editingRule={editingRule}
        categories={categories}
        saving={saving}
        onClose={() => {
          setModalOpen(false);
          setEditingRule(null);
        }}
        onSave={handleSave}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete hotel rule?"
        description={
          pendingDelete
            ? `Remove "${pendingDelete.title}" from local storage and delete its vector from Chroma DB?`
            : ''
        }
        confirmLabel="Delete Rule"
        busy={confirmBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          setConfirmBusy(true);
          try {
            await onDeleteRule(pendingDelete.id);
            setPendingDelete(null);
          } finally {
            setConfirmBusy(false);
          }
        }}
      />

      <ConfirmModal
        open={confirmResetOpen}
        title="Reset all hotel rules to defaults?"
        description="This replaces your current rules with the 18 default Grand Aurora Hotel policies and rebuilds the Chroma DB vector index."
        confirmLabel="Reset & Re-embed"
        busy={confirmBusy}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={async () => {
          setConfirmBusy(true);
          try {
            await onResetRules();
            setConfirmResetOpen(false);
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}
