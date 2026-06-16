import { Injectable } from '@nestjs/common';
import { SubmissionEvidence } from '../types/submission-evidence.types';
import { RuleEngineResult, StructuredRubric } from '../types/structured-rubric.types';
import { runRuleCriterion } from './rule-catalog';

@Injectable()
export class RuleEngineService {
  evaluate(evidence: SubmissionEvidence, rubric: StructuredRubric): RuleEngineResult {
    const ruleCriteria = rubric.criteria.filter((c) => c.type === 'rule' && c.ruleKey);
    const criteria = ruleCriteria.map((c) => runRuleCriterion(c.ruleKey!, evidence, c));
    const automatedScore = criteria.reduce((sum, c) => sum + c.score, 0);
    const automatedChecksPassed = criteria.filter((c) => c.passed).length;
    return {
      criteria,
      automatedScore,
      automatedChecksPassed,
      automatedChecksTotal: criteria.length,
    };
  }
}
