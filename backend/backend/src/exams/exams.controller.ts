import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Exams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('exams')
export class ExamsController {
  constructor(private examsService: ExamsService) {}

  @Get()
  findAll(@Query('schoolId') schoolId?: string, @Query('status') status?: string) {
    return this.examsService.findAll({ schoolId, status: status as any });
  }

  @Get('upcoming')
  getUpcoming(@Query('schoolId') schoolId: string) {
    return this.examsService.getUpcoming(schoolId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'TUTOR')
  create(@Body() body: any) {
    return this.examsService.create(body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'TUTOR')
  update(@Param('id') id: string, @Body() body: any) {
    return this.examsService.update(id, body);
  }
}
