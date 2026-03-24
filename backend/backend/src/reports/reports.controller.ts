import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  findAll(@Query('tutorId') tutorId?: string, @Query('schoolId') schoolId?: string, @Query('status') status?: string) {
    return this.reportsService.findAll({ tutorId, schoolId, status });
  }

  @Get('my-reports')
  @Roles('TUTOR')
  async getMyReports(@Request() req, @Query('status') status?: string) {
    const tutor = await (this.reportsService as any).prisma.tutor.findUnique({ where: { userId: req.user.sub } });
    return this.reportsService.findAll({ tutorId: tutor?.id, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Post()
  @Roles('TUTOR')
  async create(@Request() req, @Body() body: any) {
    const tutor = await (this.reportsService as any).prisma.tutor.findUnique({ where: { userId: req.user.sub } });
    return this.reportsService.create(tutor.id, body);
  }

  @Patch(':id/submit')
  @Roles('TUTOR')
  submit(@Param('id') id: string) {
    return this.reportsService.submit(id);
  }

  @Patch(':id/review')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  review(@Param('id') id: string, @Request() req, @Body('notes') notes: string) {
    return this.reportsService.review(id, req.user.sub, notes);
  }

  @Patch(':id')
  @Roles('TUTOR')
  update(@Param('id') id: string, @Body() body: any) {
    return this.reportsService.update(id, body);
  }
}
