import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post('start')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  start(@Request() req, @Body() body: any) {
    return this.sessionsService.startSession(req.user.sub, body);
  }

  @Patch(':id/end')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  end(@Param('id') id: string, @Body('studentsPresent') present: number, @Body('notes') notes: string) {
    return this.sessionsService.endSession(id, present, notes);
  }

  @Get('active')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  getActive(@Request() req) {
    return this.sessionsService.getActiveSession(req.user.sub);
  }

  @Get('my-sessions')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  getMySessions(@Request() req) {
    return this.sessionsService.getTutorSessions(req.user.sub);
  }

  @Get('school/:schoolId/coverage')
  @UseGuards(RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  getSchoolCoverage(
    @Param('schoolId') schoolId: string,
    @Query('weekStart') weekStart: string | undefined,
    @Request() req: { user: { sub: string; role: string } },
  ) {
    return this.sessionsService.getSchoolSessionCoverage(
      schoolId,
      weekStart,
      req.user.role,
      req.user.sub,
    );
  }

  @Get('school/:schoolId')
  @UseGuards(RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  getSchoolSessions(
    @Param('schoolId') schoolId: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sessionsService.getSchoolSessions(
      schoolId,
      limit ? parseInt(limit, 10) : undefined,
      from,
      to,
    );
  }
}
