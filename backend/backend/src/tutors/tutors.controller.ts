import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TutorsService } from './tutors.service';
import { CreateTutorDto } from './dto/create-tutor.dto';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  TutorOnboardingGuard,
  AllowIncompleteTutorProfile,
} from '../auth/guards/jwt-auth.guard';

@ApiTags('Tutors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
@Controller('tutors')
export class TutorsController {
  constructor(private tutorsService: TutorsService) {}

  @Get('me')
  @Roles('TUTOR')
  @AllowIncompleteTutorProfile()
  getMyProfile(@Request() req) {
    return this.tutorsService.findByUserId(req.user.sub);
  }

  @Patch('me')
  @Roles('TUTOR')
  @AllowIncompleteTutorProfile()
  patchMyProfile(@Request() req, @Body() body: Record<string, unknown>) {
    return this.tutorsService.updateMyProfileByUserId(req.user.sub, body);
  }

  @Post('me/complete-onboarding')
  @Roles('TUTOR')
  @AllowIncompleteTutorProfile()
  completeOnboarding(@Request() req) {
    return this.tutorsService.completeOnboardingByUserId(req.user.sub);
  }

  @Get('me/stats')
  @Roles('TUTOR')
  async getMyStats(@Request() req) {
    const tutor = await this.tutorsService.findByUserId(req.user.sub);
    return this.tutorsService.getTutorStats(tutor.id);
  }

  @Get('me/classes')
  @Roles('TUTOR')
  async getMyClasses(@Request() req) {
    const tutor = await this.tutorsService.findByUserId(req.user.sub);
    return this.tutorsService.getTutorClasses(tutor.id);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  findAll(
    @Request() req: { user: { sub: string; role: string } },
    @Query('isVerified') isVerified?: string,
    @Query('search') search?: string,
  ) {
    if (req.user.role === 'SCHOOL_ADMIN') {
      return this.tutorsService.findForSchoolAdmin(req.user.sub);
    }
    return this.tutorsService.findAll({ isVerified: isVerified === 'true' ? true : undefined, search });
  }

  @Patch('assignments/:assignmentId/remove')
  @Roles('SUPER_ADMIN')
  removeAssignment(@Param('assignmentId') id: string) {
    return this.tutorsService.removeFromSchool(id);
  }

  @Patch('assignments/:assignmentId/expectation')
  @Roles('SUPER_ADMIN')
  updateAssignmentExpectation(
    @Param('assignmentId') id: string,
    @Body('expectedSessionsPerWeek') expectedSessionsPerWeek: number,
  ) {
    return this.tutorsService.updateAssignmentExpectation(id, expectedSessionsPerWeek);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  findOne(@Param('id') id: string, @Request() req: { user: { sub: string; role: string } }) {
    if (req.user.role === 'SUPER_ADMIN') {
      return this.tutorsService.findOne(id);
    }
    return this.tutorsService.findOneForSchoolAdmin(id, req.user.sub);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() body: CreateTutorDto) {
    return this.tutorsService.create(body);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.tutorsService.update(id, body);
  }

  @Post(':id/assign')
  @Roles('SUPER_ADMIN')
  assign(@Param('id') id: string, @Body() body: any) {
    return this.tutorsService.assignToSchool(id, body.schoolId, body);
  }

  @Patch(':id/deactivate')
  @Roles('SUPER_ADMIN')
  deactivate(@Param('id') id: string) {
    return this.tutorsService.deactivate(id);
  }

  @Patch(':id/verify')
  @Roles('SUPER_ADMIN')
  verify(@Param('id') id: string, @Body('isVerified') isVerified: boolean) {
    return this.tutorsService.setVerified(id, isVerified);
  }
}
