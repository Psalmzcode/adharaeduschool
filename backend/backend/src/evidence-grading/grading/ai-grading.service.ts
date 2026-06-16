import { Injectable } from '@nestjs/common';
import { SubmissionEvidence } from '../types/submission-evidence.types';
import { AiGradingResult, StructuredRubric } from '../types/structured-rubric.types';
import { AIGradingAdapter } from './ai-grading.adapter';
import { GeminiGradingAdapter } from './gemini-grading.adapter';

/** Provider-agnostic AI grading — Gemini is the only adapter in v1. */
@Injectable()
export class AiGradingService {
  private adapter: AIGradingAdapter;

  constructor(gemini: GeminiGradingAdapter) {
    this.adapter = gemini;
  }

  async grade(input: {
    evidence: SubmissionEvidence;
    rubric: StructuredRubric;
    modelAnswer?: string;
    lessonObjective?: string;
    taskTitle?: string;
    taskInstructions?: string;
  }): Promise<AiGradingResult> {
    return this.adapter.grade(input);
  }
}
