export type RubricCriterionType = 'rule' | 'ai';

export interface StructuredRubricCriterion {
  id: string;
  title: string;
  points: number;
  type: RubricCriterionType;
  ruleKey?: string;
}

export interface StructuredRubric {
  submissionType: string;
  allowedExtensions?: string[];
  maxSizeMB?: number;
  criteria: StructuredRubricCriterion[];
  modelAnswer?: string;
  lessonObjective?: string;
}

export interface RuleCriterionResult {
  id: string;
  title: string;
  score: number;
  maxPoints: number;
  method: 'rule';
  passed: boolean;
  detail: string;
}

export interface RuleEngineResult {
  criteria: RuleCriterionResult[];
  automatedScore: number;
  automatedChecksPassed: number;
  automatedChecksTotal: number;
}

export interface AiCriterionResult {
  id: string;
  score: number;
  maxPoints: number;
  feedback: string;
}

export interface AiGradingResult {
  criteria: AiCriterionResult[];
  overallFeedback: string;
  confidence: number;
  flags: string[];
  provider: string;
  modelUsed?: string;
}

export interface GradingProposal {
  automatedScore: number;
  aiScore: number;
  totalProposedScore: number;
  maxScore: number;
  confidence: number;
  manualReviewRequired: boolean;
  canAutoApprove: boolean;
  extractionStatus: string;
  ruleEngineResult: RuleEngineResult;
  aiGradingResult?: AiGradingResult;
  breakdown: Array<{
    id: string;
    title: string;
    score: number;
    maxPoints: number;
    method: 'rule' | 'ai';
    detail?: string;
    feedback?: string;
  }>;
  overallFeedback: string;
  provider?: string;
  modelUsed?: string;
}
