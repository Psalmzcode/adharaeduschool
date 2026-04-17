import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { CompleteSchoolProfileDto } from './dto/complete-school-profile.dto';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolStatus } from '@prisma/client';

@ApiTags('Schools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private schoolsService: SchoolsService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  findAll(
    @Query('status') status?: SchoolStatus,
    @Query('state') state?: string,
    @Query('search') search?: string,
  ) {
    return this.schoolsService.findAll({ status, state, search });
  }

  @Get('my-school')
  @Roles('SCHOOL_ADMIN')
  getMySchool(@Request() req) {
    return this.schoolsService.findByAdmin(req.user.sub);
  }

  @Get('my-school/stats')
  @Roles('SCHOOL_ADMIN')
  async getMySchoolStats(@Request() req) {
    const school = await this.schoolsService.findByAdmin(req.user.sub);
    return this.schoolsService.getAdminStats(school.id);
  }

  @Get('my-school/top-students')
  @Roles('SCHOOL_ADMIN')
  async getTopStudents(@Request() req) {
    const school = await this.schoolsService.findByAdmin(req.user.sub);
    return this.schoolsService.getTopStudents(school.id);
  }

  @Get('my-school/attendance')
  @Roles('SCHOOL_ADMIN')
  async getAttendance(@Request() req) {
    const school = await this.schoolsService.findByAdmin(req.user.sub);
    return this.schoolsService.getAttendanceOverview(school.id);
  }

  @Post('my-school/complete-profile')
  @Roles('SCHOOL_ADMIN')
  completeProfile(@Request() req, @Body() dto: CompleteSchoolProfileDto) {
    return this.schoolsService.completeProfile(req.user.sub, dto);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  update(@Param('id') id: string, @Body() body: any, @Request() req) {
    return this.schoolsService.update(id, body, req.user.sub, req.user.role);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: SchoolStatus,
    @Body('notes') notes?: string,
  ) {
    return this.schoolsService.updateStatus(id, status, notes);
  }

  @Post(':id/resend-pending-approval-email')
  @Roles('SUPER_ADMIN')
  resendPendingApprovalEmail(@Param('id') id: string) {
    return this.schoolsService.resendPendingApprovalEmail(id);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  deletePending(@Param('id') id: string) {
    return this.schoolsService.deletePendingSchool(id);
  }
}
