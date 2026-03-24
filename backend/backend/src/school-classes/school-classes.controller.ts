import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolClassesService } from './school-classes.service';

@ApiTags('School Classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
@Controller('school-classes')
export class SchoolClassesController {
  constructor(private readonly service: SchoolClassesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  findAll(@Query('schoolId') schoolId: string, @Request() req) {
    return this.service.findAll(schoolId, req.user.sub, req.user.role);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  create(@Body() body: any, @Request() req) {
    return this.service.create(
      {
        schoolId: body.schoolId,
        className: body.className,
        track: body.track,
      },
      req.user.sub,
      req.user.role,
    );
  }
}
