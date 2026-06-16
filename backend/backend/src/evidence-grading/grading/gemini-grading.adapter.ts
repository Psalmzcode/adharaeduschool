import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { geminiGenerateJson } from '../../common/gemini-json.client';
import { SubmissionEvidence } from '../types/submission-evidence.types';
import { AiGradingResult, StructuredRubric } from '../types/structured-rubric.types';
import { AIGradingAdapter, AI_GRADING_PROVIDER } from './ai-grading.adapter';
import { buildGradingPrompt } from './build-grading-prompt';

@Injectable()
export class GeminiGradingAdapter implements AIGradingAdapter {
  constructor(private config: ConfigService) {}

  async grade(input: {
    evidence: SubmissionEvidence;
    rubric: StructuredRubric;
    modelAnswer?: string;
    lessonObjective?: string;
    taskTitle?: string;
    taskInstructions?: string;
  }): Promise<AiGradingResult> {
    const aiCriteria = input.rubric.criteria.filter((c) => c.type === 'ai');
    if (!aiCriteria.length) {
      return {
        criteria: [],
        overallFeedback: 'No AI criteria on this rubric.',
        confidence: 1,
        flags: [],
        provider: AI_GRADING_PROVIDER,
      };
    }

    const prompt = buildGradingPrompt(input);
    const { jsonText, modelUsed } = await geminiGenerateJson(this.config, prompt, { temperature: 0.2 });
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException('AI returned invalid JSON for grading');
    }

    const rawCriteria = Array.isArray(parsed?.criteria) ? parsed.criteria : [];
    const criteria = aiCriteria.map((c) => {
      const match = rawCriteria.find((r: any) => String(r?.id) === c.id) || rawCriteria[aiCriteria.indexOf(c)];
      const score = Number(match?.score);
      const bounded = Number.isFinite(score) ? Math.max(0, Math.min(c.points, score)) : 0;
      return {
        id: c.id,
        score: bounded,
        maxPoints: c.points,
        feedback: String(match?.feedback || '').trim() || `Scored ${bounded}/${c.points}`,
      };
    });

    const confidenceRaw = Number(parsed?.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.7;
    const flags = Array.isArray(parsed?.flags) ? parsed.flags.map((f: any) => String(f)).filter(Boolean) : [];

    return {
      criteria,
      overallFeedback: String(parsed?.overallFeedback || '').trim() || 'AI grading complete — please review.',
      confidence,
      flags,
      provider: AI_GRADING_PROVIDER,
      modelUsed,
    };
  }
}
