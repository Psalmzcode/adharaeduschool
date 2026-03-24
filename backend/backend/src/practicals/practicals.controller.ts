import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';
import { PracticalsService } from './practicals.service';

@ApiTags('Practicals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('practicals')
export class PracticalsController {
  constructor(private readonly service: PracticalsService) {}

  @Get('my-tasks')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  myTasks(@Request() req) {
    return this.service.listStudentTasks(req.user.sub);
  }

  @Get('tasks')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  tasks(
    @Request() req,
    @Query('schoolId') schoolId?: string,
    @Query('className') className?: string,
    @Query('moduleId') moduleId?: string,
    @Query('tutorId') tutorId?: string,
  ) {
    return this.service.listTasks({
      tutorId: tutorId || (req.user.role === 'TUTOR' ? req.user.sub : undefined),
      schoolId,
      className,
      moduleId,
    });
  }

  @Get('tasks/:id/submissions')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  submissions(@Param('id') id: string) {
    return this.service.listSubmissions(id);
  }

  @Post('tasks')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  createTask(@Request() req, @Body() body: any) {
    return this.service.createTask(req.user.sub, body);
  }

  @Post('tasks/:id/submit')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  submit(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.service.submit(id, req.user.sub, {
      evidenceUrl: body.evidenceUrl,
      evidenceText: body.evidenceText,
    });
  }

  @Patch('submissions/:id/grade')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN')
  grade(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.service.gradeSubmission(id, req.user.sub, {
      totalScore: body.totalScore,
      feedback: body.feedback,
      scoreBreakdown: body.scoreBreakdown,
    });
  }

  @Patch('tasks/:id/bulk-grade')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN')
  bulkGrade(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.service.bulkGrade(id, req.user.sub, {
      submissionIds: body.submissionIds,
      totalScore: body.totalScore,
      feedback: body.feedback,
      scoreBreakdown: body.scoreBreakdown,
    });
  }
}
