import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumLessonsService } from './curriculum-lessons.service';
import { ClassCurriculumService } from './class-curriculum.service';
import { LessonActivitiesService } from './lesson-activities.service';

@Module({
  controllers: [CurriculumController],
  providers: [CurriculumLessonsService, ClassCurriculumService, LessonActivitiesService],
  exports: [CurriculumLessonsService, ClassCurriculumService, LessonActivitiesService],
})
export class CurriculumModule {}
