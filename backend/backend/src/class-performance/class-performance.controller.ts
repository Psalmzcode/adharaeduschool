import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClassPerformanceService } from './class-performance.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Class performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard, RolesGuard)
@Controller('class-performance')
export class ClassPerformanceController {
  constructor(private readonly classPerformanceService: ClassPerformanceService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  getRollup(
    @Request() req: { user: { sub: string; role: string } },
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
    @Query('days') days?: string,
    @Query('track') track?: string,
  ) {
    return this.classPerformanceService.getRollup(
      req.user.sub,
      req.user.role,
      schoolId,
      className,
      days ? parseInt(days, 10) : 30,
      track,
    );
  }
}
