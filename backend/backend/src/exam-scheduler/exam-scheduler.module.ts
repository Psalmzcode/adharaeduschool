import { Module } from '@nestjs/common';
import { ExamSchedulerController } from './exam-scheduler.controller';
import { ExamSchedulerService } from './exam-scheduler.service';
@Module({ controllers: [ExamSchedulerController], providers: [ExamSchedulerService], exports: [ExamSchedulerService] })
export class ExamSchedulerModule {}
