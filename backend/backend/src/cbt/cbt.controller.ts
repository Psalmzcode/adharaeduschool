import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CbtService } from './cbt.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('CBT')
@Controller('cbt')
export class CbtController {
  constructor(private cbtService: CbtService) {}

  @Post('login')
  cbtLogin(@Body('regNumber') regNumber: string, @Body('token') token: string, @Body('examId') examId: string) {
    return this.cbtService.cbtLogin(regNumber, token, examId);
  }

  /** Student CBT login anchored to an exam schedule (time-gated + schedule access code). */
  @Post('login-schedule')
  cbtLoginSchedule(
    @Body('regNumber') regNumber: string,
    @Body('token') token: string,
    @Body('scheduleId') scheduleId: string,
  ) {
    return this.cbtService.cbtLoginSchedule(regNumber, token, scheduleId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  findAll(
    @Request() req: { user: { sub: string; role: string } },
    @Query('tutorId') tutorId?: string,
    @Query('track') track?: string,
  ) {
    // Tutors should only see their own exams by default.
    if (req.user.role === 'TUTOR') {
      return this.cbtService.findAll({ tutorUserId: req.user.sub, track: track as any });
    }
    return this.cbtService.findAll({ tutorId, track: track as any });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, TutorOnboardingGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  findOne(
    @Request() req: { user: { role: string } },
    @Param('id') id: string,
    @Query('includeAnswers') includeAnswers?: string,
  ) {
    const wantAnswers = String(includeAnswers || '').toLowerCase() === 'true';
    if (wantAnswers && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only super admin can view answer keys');
    }
    return this.cbtService.findOne(id, wantAnswers);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  @Roles('TUTOR')
  create(@Request() req, @Body() body: any) {
    return this.cbtService.createExam(req.user.sub, body);
  }

  /** Gemini: draft CBT questions from module curriculum (or multiple modules for term exams). */
  @Post('generate-questions')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  @Roles('TUTOR', 'SUPER_ADMIN', 'CURRICULUM_LEAD')
  generate(@Body() body: any) {
    return this.cbtService.generateQuestions(body);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  @Roles('TUTOR', 'SUPER_ADMIN')
  publish(@Param('id') id: string) {
    return this.cbtService.publishExam(id);
  }

  @Patch(':id/vet')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN')
  vet(@Param('id') id: string, @Body('vetted') vetted: boolean) {
    return this.cbtService.vetExam(id, vetted);
  }

  @Post('attempts/start')
  @UseGuards(JwtAuthGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  startExam(@Body('examId') examId: string, @Body('studentId') studentId: string) {
    return this.cbtService.startExam(examId, studentId);
  }

  @Patch('attempts/:id/answer')
  @UseGuards(JwtAuthGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  saveAnswer(@Param('id') id: string, @Body('questionNumber') qNum: number, @Body('selectedIndex') idx: number) {
    return this.cbtService.saveAnswer(id, qNum, idx);
  }

  @Post('attempts/:id/submit')
  @UseGuards(JwtAuthGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  submitExam(@Param('id') id: string, @Body('answers') answers?: Record<string, number>) {
    return this.cbtService.submitExam(id, answers);
  }

  @Get('attempts/:id/result')
  @UseGuards(JwtAuthGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  getResult(@Param('id') id: string, @Request() req: { user: { sub: string; role: string } }) {
    return this.cbtService.getAttemptResult(id, req.user);
  }

  @Get(':id/attempts')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @ApiBearerAuth()
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  getAttempts(@Param('id') id: string) {
    return this.cbtService.getExamAttempts(id);
  }
}
