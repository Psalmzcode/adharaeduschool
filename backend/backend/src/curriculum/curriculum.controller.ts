import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Track3Stack, TrackLevel } from '@prisma/client';
import { CurriculumLessonsService } from './curriculum-lessons.service';
import { ClassCurriculumService } from './class-curriculum.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Curriculum')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('curriculum')
export class CurriculumController {
  constructor(
    private lessonsService: CurriculumLessonsService,
    private classState: ClassCurriculumService,
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
