import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumLessonsService } from './curriculum-lessons.service';
import { ClassCurriculumService } from './class-curriculum.service';

@Module({
  controllers: [CurriculumController],
  providers: [CurriculumLessonsService, ClassCurriculumService],
  exports: [CurriculumLessonsService, ClassCurriculumService],
})
export class CurriculumModule {}
