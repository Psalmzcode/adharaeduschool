import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
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
  updateClassScores(@Request() req, @Body() body: any) {
    return this.modulesService.updateClassScores(
      body.schoolId,
      body.className,
      body.moduleId,
      body.scores || [],
      { userId: req.user.sub, role: req.user.role },
    );
  }

  @Patch('class-progress/advance')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SUPER_ADMIN')
  advanceClass(@Request() req, @Body() body: any) {
    return this.modulesService.advanceClassModule(
      body.schoolId,
      body.className,
      body.moduleId,
      body.passMark,
      { userId: req.user.sub, role: req.user.role },
    );
  }

  @Get('class-progress/suggested-scores')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SUPER_ADMIN')
  suggestedScores(
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
    @Query('moduleId') moduleId: string,
    @Query('passMark') passMark?: string,
  ) {
    return this.modulesService.getClassSuggestedModuleScores(
      schoolId,
      className,
      moduleId,
      passMark ? Number(passMark) : 50,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.modulesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'CURRICULUM_LEAD')
  create(@Body() body: any) {
    return this.modulesService.create(body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'CURRICULUM_LEAD')
  update(@Param('id') id: string, @Body() body: any) {
    return this.modulesService.update(id, body);
  }

  @Patch('progress/:studentId/:moduleId')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SUPER_ADMIN')
  updateProgress(@Param('studentId') studentId: string, @Param('moduleId') moduleId: string, @Body() body: any) {
    return this.modulesService.updateProgress(studentId, moduleId, body);
  }

  @Get('retake-status')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SUPER_ADMIN')
  retakeStatus(@Query('studentId') studentId: string, @Query('moduleId') moduleId: string, @Query('passMark') passMark?: string) {
    return this.modulesService.getModuleRetakeStatus(studentId, moduleId, passMark ? Number(passMark) : 50);
  }

  @Patch('retake/:studentId/:moduleId')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SUPER_ADMIN')
  applyRetake(
    @Request() req,
    @Param('studentId') studentId: string,
    @Param('moduleId') moduleId: string,
    @Body() body: any,
  ) {
    return this.modulesService.applyModuleRetake(
      req.user.sub,
      studentId,
      moduleId,
      body?.passMark ? Number(body.passMark) : 50,
      req.user.role,
    );
  }

  @Get('progress/:studentId')
  getStudentProgress(@Param('studentId') studentId: string) {
    return this.modulesService.getStudentProgress(studentId);
  }
}
