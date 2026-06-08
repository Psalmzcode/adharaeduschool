import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
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
    @Query('termLabel') termLabel?: string,
  ) {
    return this.classPerformanceService.getRollup(
      req.user.sub,
      req.user.role,
      schoolId,
      className,
      days ? parseInt(days, 10) : 30,
      track,
      termLabel,
    );
  }

  @Get('export/csv')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  async exportCsv(
    @Request() req: { user: { sub: string; role: string } },
    @Res() res: Response,
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
    @Query('days') days?: string,
    @Query('track') track?: string,
    @Query('termLabel') termLabel?: string,
  ) {
    const csv = await this.classPerformanceService.exportCsv(
      req.user.sub,
      req.user.role,
      schoolId,
      className,
      days ? parseInt(days, 10) : undefined,
      track,
      termLabel,
    );
    const safeClass = String(className || 'class').replace(/[^\w-]+/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="class-performance-${safeClass}.csv"`);
    res.send(csv);
  }

  @Get('export/pdf')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  async exportPdf(
    @Request() req: { user: { sub: string; role: string } },
    @Res() res: Response,
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
    @Query('days') days?: string,
    @Query('track') track?: string,
    @Query('termLabel') termLabel?: string,
  ) {
    const pdf = await this.classPerformanceService.exportTermReportPdf(
      req.user.sub,
      req.user.role,
      schoolId,
      className,
      days ? parseInt(days, 10) : undefined,
      track,
      termLabel,
    );
    const safeClass = String(className || 'class').replace(/[^\w-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="term-report-${safeClass}.pdf"`);
    res.send(pdf);
  }
}
