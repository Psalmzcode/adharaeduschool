'use client'

import { defaultStructuredRubric, RULE_KEYS_BY_TYPE, type RubricCriterion, type StructuredRubric } from './structured-rubric-defaults'

function newId() {
  return `c_${Math.random().toString(36).slice(2, 9)}`
}

export function StructuredRubricBuilder({
  submissionType,
  maxScore,
  value,
  onChange,
}: {
  submissionType: string
  maxScore: number
  value: StructuredRubric | null
  onChange: (rubric: StructuredRubric | null) => void
}) {
  const rubric = value || null
  const criteria = rubric?.criteria || []
  const ruleOptions = RULE_KEYS_BY_TYPE[submissionType] || []

  const setCriteria = (next: RubricCriterion[]) => {
    if (!next.length) {
      onChange(null)
      return
    }
    onChange({ submissionType, criteria: next })
  }

  const updateRow = (index: number, patch: Partial<RubricCriterion>) => {
    const next = criteria.map((c, i) => (i === index ? { ...c, ...patch } : c))
    setCriteria(next)
  }

  const addRow = () => {
    setCriteria([
      ...criteria,
      { id: newId(), title: 'New criterion', points: 10, type: 'ai' },
    ])
  }

  const removeRow = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index))
  }

  const loadDefaults = () => {
    onChange(defaultStructuredRubric(submissionType, maxScore))
  }

  const totalPoints = criteria.reduce((s, c) => s + (Number(c.points) || 0), 0)

  return (
    <div>
      <div className="flex-between mb-8" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label className="form-label" style={{ margin: 0 }}>Grading rubric</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadDefaults}>
            Load recommended
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addRow}>
            + Criterion
          </button>
        </div>
      </div>
      <p className="text-muted text-xs mb-10" style={{ lineHeight: 1.5 }}>
        Rule criteria are checked automatically from extracted evidence. AI criteria are scored by Gemini for tutor review.
        Total: {totalPoints}/{maxScore} pts
      </p>
      {criteria.length === 0 ? (
        <p className="text-muted text-sm" style={{ padding: '12px 0' }}>
          No rubric configured — the engine will use type defaults. Click <strong className="text-white">Load recommended</strong> to customize.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {criteria.map((row, index) => (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 72px 88px 1fr auto',
                gap: 8,
                alignItems: 'center',
                padding: '8px 10px',
                border: '1px solid var(--border2)',
                borderRadius: 8,
                background: 'var(--muted3)',
              }}
            >
              <input
                className="form-input"
                value={row.title}
                onChange={(e) => updateRow(index, { title: e.target.value })}
                placeholder="Criterion title"
              />
              <input
                type="number"
                className="form-input"
                min={0}
                value={row.points}
                onChange={(e) => updateRow(index, { points: Number(e.target.value) || 0 })}
                title="Points"
              />
              <select
                className="form-input"
                value={row.type}
                onChange={(e) => {
                  const type = e.target.value as 'rule' | 'ai'
                  updateRow(index, { type, ruleKey: type === 'rule' ? row.ruleKey || ruleOptions[0]?.key : undefined })
                }}
                style={{ appearance: 'none' }}
              >
                <option value="rule">Rule</option>
                <option value="ai">AI</option>
              </select>
              {row.type === 'rule' ? (
                <select
                  className="form-input"
                  value={row.ruleKey || ''}
                  onChange={(e) => updateRow(index, { ruleKey: e.target.value })}
                  style={{ appearance: 'none' }}
                >
                  <option value="">Select rule…</option>
                  {ruleOptions.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-muted text-xs">AI subjective review</span>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(index)} aria-label="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
