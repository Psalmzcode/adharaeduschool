import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Track3Stack, TrackLevel } from '@prisma/client';
import { CurriculumLessonsService } from './curriculum-lessons.service';
import { ClassCurriculumService } from './class-curriculum.service';
import { LessonActivitiesService } from './lesson-activities.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Curriculum')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('curriculum')
export class CurriculumController {
  constructor(
    private lessonsService: CurriculumLessonsService,
    private classState: ClassCurriculumService,
    private lessonActivities: LessonActivitiesService,
  ) {}

  @Get('modules/:moduleId/lessons')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'CURRICULUM_LEAD', 'STUDENT')
  listByModule(
    @Request() req: { user: { role: string } },
    @Param('moduleId') moduleId: string,
    @Query('includeUnpublished') includeUnpublished?: string,
  ) {
    const elevated = req.user.role === 'SUPER_ADMIN' || req.user.role === 'CURRICULUM_LEAD';
    const pub = elevated && String(includeUnpublished) === 'true' ? false : true;
    return this.lessonsService.listForModule(moduleId, { publishedOnly: pub });
  }

  /** Canonical + module fallback files for the signed-in student (class current lesson → module). */
  @Get('my-learning-materials')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  myLearningMaterials(@Request() req) {
    return this.classState.getLearningMaterialsForStudent(req.user.sub);
  }

  @Get('my-lesson-journey')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  myLessonJourney(@Request() req) {
    return this.classState.getStudentLessonJourney(req.user.sub);
  }

  @Get('lessons/:id')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'CURRICULUM_LEAD', 'STUDENT')
  one(@Param('id') id: string) {
    return this.lessonsService.findOne(id);
  }

  @Post('lessons')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'CURRICULUM_LEAD')
  create(@Body() body: any) {
    return this.lessonsService.create(body);
  }

  @Patch('lessons/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'CURRICULUM_LEAD')
  update(@Param('id') id: string, @Body() body: any) {
    return this.lessonsService.update(id, body);
  }

  @Delete('lessons/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'CURRICULUM_LEAD')
  remove(@Param('id') id: string) {
    return this.lessonsService.delete(id);
  }

  @Get('lesson-activities')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  listLessonActivities(
    @Request() req,
    @Query('moduleId') moduleId: string,
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
  ) {
    return this.lessonActivities.listForModule(req.user.sub, moduleId, schoolId, className);
  }

  @Get('lesson-formative-summary')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  lessonFormativeSummary(
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
    @Query('moduleId') moduleId: string,
  ) {
    return this.lessonActivities.classFormativeSummaries(schoolId, className, moduleId);
  }

  @Post('lessons/:lessonId/micro-quiz')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  upsertMicroQuiz(@Request() req, @Param('lessonId') lessonId: string, @Body() body: any) {
    return this.lessonActivities.upsertMicroQuiz(req.user.sub, {
      curriculumLessonId: lessonId,
      schoolId: body.schoolId,
      className: body.className,
      moduleId: body.moduleId,
      isEnabled: body.isEnabled,
      title: body.title,
      questions: body.questions,
    });
  }

  @Delete('micro-quiz/:quizId')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  disableMicroQuiz(@Request() req, @Param('quizId') quizId: string) {
    return this.lessonActivities.disableMicroQuiz(req.user.sub, quizId);
  }

  @Post('lessons/:lessonId/lesson-assignment')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  upsertLessonAssignment(@Request() req, @Param('lessonId') lessonId: string, @Body() body: any) {
    return this.lessonActivities.upsertLessonAssignment(req.user.sub, {
      curriculumLessonId: lessonId,
      schoolId: body.schoolId,
      className: body.className,
      moduleId: body.moduleId,
      enabled: body.enabled !== false,
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      maxScore: body.maxScore,
      isOptional: body.isOptional,
      submissionType: body.submissionType,
    });
  }

  @Post('micro-quiz/:quizId/submit')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  submitMicroQuiz(@Request() req, @Param('quizId') quizId: string, @Body() body: { answers: number[] }) {
    return this.lessonActivities.submitMicroQuiz(req.user.sub, quizId, body.answers || []);
  }

  @Get('class-state')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'CURRICULUM_LEAD')
  getClassState(
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
    @Query('track') track: string,
    @Query('track3Stack') track3Stack?: string,
  ) {
    const t = String(track || '').trim() as TrackLevel;
    if (!Object.values(TrackLevel).includes(t)) {
      return null;
    }
    const stack =
      t === TrackLevel.TRACK_3 && track3Stack && Object.values(Track3Stack).includes(track3Stack as Track3Stack)
        ? (track3Stack as Track3Stack)
        : t === TrackLevel.TRACK_3
          ? Track3Stack.PYTHON_FLASK
          : null;
    return this.classState.getState(schoolId, className, t, stack);
  }
}
