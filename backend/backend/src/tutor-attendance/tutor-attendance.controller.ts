import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TutorAttendanceStatus } from '@prisma/client';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';
import { TutorAttendanceService } from './tutor-attendance.service';

@ApiTags('Tutor attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard, RolesGuard)
@Controller('tutor-attendance')
export class TutorAttendanceController {
  constructor(private readonly service: TutorAttendanceService) {}

  @Post('check-in')
  @Roles('TUTOR')
  checkIn(@Request() req: { user: { sub: string } }, @Body() body: { schoolId: string; notes?: string }) {
    return this.service.checkIn(req.user.sub, body.schoolId, body.notes);
  }

  @Get('mine')
  @Roles('TUTOR')
  mine(@Request() req: { user: { sub: string } }) {
    return this.service.myLog(req.user.sub);
  }

  @Get('school/:schoolId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  bySchool(
    @Param('schoolId') schoolId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listForSchool(schoolId, from, to);
  }

  @Post('mark')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  mark(
    @Request() req: { user: { sub: string; role: string } },
    @Body()
    body: {
      tutorId: string
      schoolId: string
      date: string
      status: TutorAttendanceStatus
      notes?: string
    },
  ) {
    return this.service.markByAdmin(req.user.sub, req.user.role, body);
  }
}
