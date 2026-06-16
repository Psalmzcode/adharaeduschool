import { SubmissionEvidence } from '../types/submission-evidence.types';
import { StructuredRubric } from '../types/structured-rubric.types';
import { defaultStructuredRubric } from '../rules/rule-catalog';

export function formatEvidenceForPrompt(evidence: SubmissionEvidence): string {
  const parts: string[] = [];

  if (evidence.metadata?.fileType) {
    parts.push(`File type: ${evidence.metadata.fileType}`);
  }
  if (evidence.metadata?.fileName) {
    parts.push(`File name: ${evidence.metadata.fileName}`);
  }
  if (evidence.metadata?.validationWarnings?.length) {
    parts.push(`Warnings: ${evidence.metadata.validationWarnings.join('; ')}`);
  }

  if (evidence.codeFiles?.length) {
    for (const f of evidence.codeFiles.slice(0, 6)) {
      parts.push(`--- ${f.filename} (${f.language}) ---\n${f.content.slice(0, 6000)}`);
    }
  } else if (evidence.tables?.length) {
    for (const t of evidence.tables.slice(0, 4)) {
      const headerLine = t.headers?.join(' | ') || '';
      const rowLines = t.rows.slice(0, 15).map((r) => r.map((v) => String(v ?? '')).join(' | '));
      parts.push(`--- Sheet: ${t.sheetName} ---\n${headerLine}\n${rowLines.join('\n')}`);
      if (t.formulas?.length) {
        parts.push(
          `Formulas (${t.sheetName}): ${t.formulas.slice(0, 20).map((f) => `${f.cell}=${f.formula}`).join('; ')}`,
        );
      }
    }
  } else if (evidence.extractedText) {
    parts.push(`--- Extracted text ---\n${evidence.extractedText.slice(0, 12000)}`);
  }

  if (evidence.scratchData) {
    parts.push(`Scratch summary: ${JSON.stringify(evidence.scratchData)}`);
  }

  if (evidence.images?.length && !evidence.extractedText) {
    for (const img of evidence.images.slice(0, 3)) {
      parts.push(`Image (${img.url}): ${img.description || 'no description'}`);
    }
  }

  return parts.join('\n\n') || '(No readable evidence extracted)';
}

export function buildGradingPrompt(opts: {
  evidence: SubmissionEvidence;
  rubric: StructuredRubric;
  modelAnswer?: string;
  lessonObjective?: string;
  taskTitle?: string;
  taskInstructions?: string;
}): string {
  const aiCriteria = opts.rubric.criteria.filter((c) => c.type === 'ai');
  return [
    `You are grading a student submission for a Nigerian secondary-school ICT / programming programme.`,
    `Return ONLY valid JSON:`,
    `{"criteria":[{"id":string,"score":number,"maxPoints":number,"feedback":string}],"overallFeedback":string,"confidence":number,"flags":string[]}`,
    ``,
    `Rules:`,
    `- Grade ONLY the AI criteria listed below (objective rule criteria were already scored separately).`,
    `- score must be 0..maxPoints for each criterion.`,
    `- confidence is 0-1 (lower if evidence is thin or ambiguous).`,
    `- flags: list issues like "incomplete", "off-topic", "possible plagiarism".`,
    `- Be fair, constructive, and specific.`,
    ``,
    `Task: ${opts.taskTitle || 'Practical submission'}`,
    opts.taskInstructions ? `Instructions: ${opts.taskInstructions}` : '',
    opts.lessonObjective ? `Lesson objective: ${opts.lessonObjective}` : '',
    opts.modelAnswer ? `Model answer / checklist:\n${opts.modelAnswer}` : '',
    ``,
    `AI CRITERIA TO GRADE:`,
    JSON.stringify(aiCriteria, null, 2),
    ``,
    `STUDENT SUBMISSION EVIDENCE (normalized — not the raw file):`,
    formatEvidenceForPrompt(opts.evidence),
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseStructuredRubricFromTask(task: {
  structuredRubric?: unknown;
  rubric?: unknown;
  submissionType?: string | null;
  maxScore?: number;
  modelAnswer?: string | null;
  lessonObjective?: string | null;
  allowedExtensions?: unknown;
  maxSizeMB?: number | null;
}): StructuredRubric {
  if (task.structuredRubric && typeof task.structuredRubric === 'object') {
    const r = task.structuredRubric as StructuredRubric;
    if (Array.isArray(r.criteria) && r.criteria.length) {
      return {
        ...r,
        modelAnswer: r.modelAnswer || task.modelAnswer || undefined,
        lessonObjective: r.lessonObjective || task.lessonObjective || undefined,
      };
    }
  }

  const base = defaultStructuredRubric(task.submissionType || 'mixed', task.maxScore || 100);
  return {
    ...base,
    allowedExtensions: Array.isArray(task.allowedExtensions) ? (task.allowedExtensions as string[]) : base.allowedExtensions,
    maxSizeMB: task.maxSizeMB ?? base.maxSizeMB,
    modelAnswer: task.modelAnswer || undefined,
    lessonObjective: task.lessonObjective || undefined,
  };
}
