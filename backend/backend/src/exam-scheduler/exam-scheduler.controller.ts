import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ExamSchedulerService } from './exam-scheduler.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Exam Schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('exam-schedules')
export class ExamSchedulerController {
  constructor(private service: ExamSchedulerService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  schedule(@Body() body: any) { return this.service.schedule(body); }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  getAll(@Query('schoolId') schoolId?: string, @Query('className') className?: string) {
    return this.service.getSchedules(schoolId, className);
  }

  @Get('upcoming')
  getUpcoming(@Query('schoolId') schoolId: string, @Query('className') className?: string) {
    return this.service.getUpcoming(schoolId, className);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  cancel(@Param('id') id: string) { return this.service.cancel(id); }
}
