export type RubricCriterion = {
  id: string
  title: string
  points: number
  type: 'rule' | 'ai'
  ruleKey?: string
}

export type StructuredRubric = {
  submissionType: string
  criteria: RubricCriterion[]
}

export const RULE_KEYS_BY_TYPE: Record<string, { key: string; label: string }[]> = {
  html: [
    { key: 'html.semanticLayout', label: 'Semantic HTML layout' },
    { key: 'html.cssLinked', label: 'CSS linked' },
    { key: 'html.usesFlexOrGrid', label: 'Flexbox or Grid' },
    { key: 'html.jsEventListener', label: 'JS event listener' },
    { key: 'html.hasTitle', label: 'Page title' },
  ],
  word: [
    { key: 'word.minWordCount200', label: 'Min 200 words' },
    { key: 'word.hasStructure', label: 'Document structure' },
    { key: 'word.hasMultipleParagraphs', label: 'Multiple paragraphs' },
  ],
  excel: [
    { key: 'excel.hasHeaders', label: 'Column headers' },
    { key: 'excel.hasDataRows', label: 'Data rows' },
    { key: 'excel.hasFormulas', label: 'Uses formulas' },
    { key: 'excel.multipleSheets', label: 'Multiple sheets' },
  ],
  scratch: [
    { key: 'scratch.minSprites', label: 'At least one sprite' },
    { key: 'scratch.hasEvents', label: 'Event scripts' },
    { key: 'scratch.hasMotion', label: 'Motion blocks' },
    { key: 'scratch.hasLogic', label: 'Loops or conditionals' },
  ],
  zip: [
    { key: 'zip.hasHtml', label: 'HTML in ZIP' },
    { key: 'zip.hasCss', label: 'CSS in ZIP' },
    { key: 'zip.hasJs', label: 'JS in ZIP' },
  ],
}

export function defaultStructuredRubric(submissionType: string, maxScore = 100): StructuredRubric {
  const half = Math.round(maxScore * 0.5)
  const presets: Record<string, RubricCriterion[]> = {
    html: [
      { id: 'semantic', title: 'Semantic HTML layout', points: 20, type: 'rule', ruleKey: 'html.semanticLayout' },
      { id: 'css', title: 'CSS linked', points: 10, type: 'rule', ruleKey: 'html.cssLinked' },
      { id: 'layout', title: 'Flexbox or Grid', points: 10, type: 'rule', ruleKey: 'html.usesFlexOrGrid' },
      { id: 'js', title: 'JavaScript interactivity', points: 10, type: 'rule', ruleKey: 'html.jsEventListener' },
      { id: 'quality', title: 'Code quality & UX', points: Math.max(20, maxScore - 50), type: 'ai' },
    ],
    word: [
      { id: 'length', title: 'Minimum word count (200+)', points: 15, type: 'rule', ruleKey: 'word.minWordCount200' },
      { id: 'structure', title: 'Document structure', points: 10, type: 'rule', ruleKey: 'word.hasStructure' },
      { id: 'paragraphs', title: 'Multiple paragraphs', points: 10, type: 'rule', ruleKey: 'word.hasMultipleParagraphs' },
      { id: 'content', title: 'Content quality & requirements', points: Math.max(25, maxScore - 35), type: 'ai' },
    ],
    excel: [
      { id: 'headers', title: 'Column headers', points: 10, type: 'rule', ruleKey: 'excel.hasHeaders' },
      { id: 'rows', title: 'Data rows present', points: 10, type: 'rule', ruleKey: 'excel.hasDataRows' },
      { id: 'formulas', title: 'Uses formulas', points: 15, type: 'rule', ruleKey: 'excel.hasFormulas' },
      { id: 'analysis', title: 'Analysis & requirements', points: Math.max(25, maxScore - 35), type: 'ai' },
    ],
    scratch: [
      { id: 'sprites', title: 'At least one sprite', points: 10, type: 'rule', ruleKey: 'scratch.minSprites' },
      { id: 'events', title: 'Event-driven scripts', points: 10, type: 'rule', ruleKey: 'scratch.hasEvents' },
      { id: 'motion', title: 'Motion blocks', points: 10, type: 'rule', ruleKey: 'scratch.hasMotion' },
      { id: 'logic', title: 'Loops or conditionals', points: 10, type: 'rule', ruleKey: 'scratch.hasLogic' },
      { id: 'creativity', title: 'Creativity & brief requirements', points: Math.max(20, maxScore - 40), type: 'ai' },
    ],
    zip: [
      { id: 'html', title: 'HTML in project', points: 15, type: 'rule', ruleKey: 'zip.hasHtml' },
      { id: 'css', title: 'CSS in project', points: 10, type: 'rule', ruleKey: 'zip.hasCss' },
      { id: 'js', title: 'JavaScript in project', points: 10, type: 'rule', ruleKey: 'zip.hasJs' },
      { id: 'quality', title: 'Project quality & requirements', points: Math.max(25, maxScore - 35), type: 'ai' },
    ],
    image: [
      { id: 'requirements', title: 'Visible requirements met', points: Math.round(maxScore * 0.55), type: 'ai' },
      { id: 'quality', title: 'Quality, clarity & effort', points: Math.max(20, maxScore - Math.round(maxScore * 0.55)), type: 'ai' },
    ],
  }

  return {
    submissionType: submissionType || 'mixed',
    criteria: presets[submissionType] || [
      { id: 'completeness', title: 'Completeness & requirements', points: half, type: 'ai' },
      { id: 'quality', title: 'Quality & clarity', points: maxScore - half, type: 'ai' },
    ],
  }
}
