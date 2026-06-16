import { Module } from '@nestjs/common';
import { ClassAssignmentsController } from './assignments.controller';
import { ClassAssignmentsService } from './assignments.service';
import { EvidenceGradingModule } from '../evidence-grading/evidence-grading.module';

@Module({
  imports: [EvidenceGradingModule],
  controllers: [ClassAssignmentsController],
  providers: [ClassAssignmentsService],
  exports: [ClassAssignmentsService],
})
export class ClassAssignmentsModule {}
