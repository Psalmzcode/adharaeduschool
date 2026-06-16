import { SubmissionEvidence } from '../types/submission-evidence.types';
import { AiGradingResult, StructuredRubric } from '../types/structured-rubric.types';

export interface AIGradingAdapter {
  grade(input: {
    evidence: SubmissionEvidence;
    rubric: StructuredRubric;
    modelAnswer?: string;
    lessonObjective?: string;
    taskTitle?: string;
    taskInstructions?: string;
  }): Promise<AiGradingResult>;
}

export const AI_GRADING_PROVIDER = 'gemini';
