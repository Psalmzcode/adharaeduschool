import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SubmissionEvidenceService } from './submission-evidence.service';
import { EvidenceGradingAdminController } from './evidence-grading-admin.controller';
import { EvidenceGradingAdminService } from './evidence-grading-admin.service';
import { UploadValidationService } from './validation/upload-validation.service';
import { RuleEngineService } from './rules/rule-engine.service';
import { GeminiGradingAdapter } from './grading/gemini-grading.adapter';
import { AiGradingService } from './grading/ai-grading.service';
import { GradingOrchestratorService } from './grading-orchestrator.service';
import { SubmissionGradingHelperService } from './submission-grading-helper.service';

import { HtmlPreviewService } from './html-preview.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [EvidenceGradingAdminController],
  providers: [
    EvidenceGradingAdminService,
    UploadValidationService,
    HtmlPreviewService,
    SubmissionEvidenceService,
    RuleEngineService,
    GeminiGradingAdapter,
    AiGradingService,
    GradingOrchestratorService,
    SubmissionGradingHelperService,
  ],
  exports: [
    SubmissionEvidenceService,
    GradingOrchestratorService,
    UploadValidationService,
    SubmissionGradingHelperService,
  ],
})
export class EvidenceGradingModule {}
