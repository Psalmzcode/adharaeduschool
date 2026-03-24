import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('lessons')
export class LessonsController {
  constructor(private lessonsService: LessonsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  getMyPlans(@Request() req) {
    return this.lessonsService.findAll(req.user.sub);
  }

  @Get('school')
  @UseGuards(RolesGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  getBySchool(@Query('schoolId') schoolId: string) {
    return this.lessonsService.findBySchool(schoolId);
  }

  @Get('my-class')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  getForStudent(@Request() req) {
    return this.lessonsService.findForStudent(req.user.sub);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  create(@Request() req, @Body() body: any) {
    return this.lessonsService.create(req.user.sub, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  update(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.lessonsService.update(id, req.user.sub, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  delete(@Param('id') id: string, @Request() req) {
    return this.lessonsService.delete(id, req.user.sub);
  }
}
