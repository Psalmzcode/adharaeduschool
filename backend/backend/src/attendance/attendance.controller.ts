import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('mark')
  @Roles('TUTOR')
  markBulk(
    @Body('records') records: any[],
    @Body('date') date: string,
    @Request() req,
  ) {
    return this.attendanceService.markBulk(records, date, req.user.sub);
  }

  @Get('class')
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  getClassAttendance(
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getClassAttendance(schoolId, className, date || new Date().toISOString().split('T')[0]);
  }

  @Get('student')
  @Roles('STUDENT', 'PARENT', 'TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  getStudentAttendance(
    @Query('studentId') studentId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getStudentAttendance(studentId, from, to);
  }

  @Get('student/weekly')
  @Roles('STUDENT', 'PARENT', 'TUTOR', 'SCHOOL_ADMIN')
  getWeekly(@Query('studentId') studentId: string, @Query('weeks') weeks?: string) {
    return this.attendanceService.getWeeklyBreakdown(studentId, weeks ? +weeks : 5);
  }

  @Get('school/stats')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  getSchoolStats(@Query('schoolId') schoolId: string, @Query('days') days?: string) {
    return this.attendanceService.getSchoolStats(schoolId, days ? +days : 7);
  }

  @Get('school/weekly')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'TUTOR')
  getSchoolWeekly(
    @Query('schoolId') schoolId: string,
    @Query('weeks') weeks?: string,
    @Query('className') className?: string,
  ) {
    return this.attendanceService.getSchoolWeekly(schoolId, weeks ? +weeks : 12, className);
  }
}
