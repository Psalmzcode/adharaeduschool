import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ModulesService } from './modules.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('modules')
export class ModulesController {
  constructor(private modulesService: ModulesService) {}

  @Get()
  findAll(@Query('track') track?: string, @Query('track3Stack') track3Stack?: string) {
    return this.modulesService.findAll(track, track3Stack);
  }

  @Get('class-progress')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  getClassProgress(
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
  ) {
    return this.modulesService.getClassProgress(schoolId, className);
  }

  @Patch('class-progress/scores')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SUPER_ADMIN')
  updateClassScores(@Body() body: any) {
    return this.modulesService.updateClassScores(
      body.schoolId,
      body.className,
      body.moduleId,
      body.scores || [],
    );
  }

  @Patch('class-progress/advance')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SUPER_ADMIN')
  advanceClass(@Body() body: any) {
    return this.modulesService.advanceClassModule(
      body.schoolId,
      body.className,
      body.moduleId,
      body.passMark,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.modulesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  create(@Body() body: any) {
    return this.modulesService.create(body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.modulesService.update(id, body);
  }

  @Patch('progress/:studentId/:moduleId')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SUPER_ADMIN')
  updateProgress(@Param('studentId') studentId: string, @Param('moduleId') moduleId: string, @Body() body: any) {
    return this.modulesService.updateProgress(studentId, moduleId, body);
  }

  @Get('progress/:studentId')
  getStudentProgress(@Param('studentId') studentId: string) {
    return this.modulesService.getStudentProgress(studentId);
  }
}
