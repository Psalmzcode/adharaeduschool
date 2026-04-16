import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CsvUploadService } from './csv-upload.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';
import { TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private studentsService: StudentsService,
    private csvUpload: CsvUploadService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  findAll(
    @Query('schoolId') schoolId: string,
    @Query('className') className?: string,
    @Query('track') track?: TrackLevel,
    @Query('search') search?: string,
    @Query('termLabel') termLabel?: string,
  ) {
    return this.studentsService.findAll(schoolId, { className, track, search, termLabel });
  }

  @Get('me')
  @Roles('STUDENT')
  getMyProfile(@Request() req) {
    return this.studentsService.findByUserId(req.user.sub);
  }

  @Get('me/stats')
  @Roles('STUDENT')
  async getMyStats(@Request() req) {
    const student = await this.studentsService.findByUserId(req.user.sub);
    return this.studentsService.getStudentStats(student.id);
  }

  @Get('me/classmates')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Search classmates (same class) by name — for student peer chat' })
  getClassmates(@Request() req, @Query('q') q?: string) {
    return this.studentsService.findClassmates(req.user.sub, q);
  }

  @Get('leaderboard')
  @Roles('STUDENT', 'TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  getLeaderboard(@Query('schoolId') schoolId: string, @Query('className') className: string) {
    return this.studentsService.getLeaderboard(schoolId, className);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  @ApiOperation({ summary: 'Reset a student password (returns a one-time temporary password)' })
  async resetPassword(@Param('id') id: string, @Request() req) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { id: true, schoolId: true, className: true, userId: true },
    });
    if (!student) throw new ForbiddenException('Student not found');

    if (req.user.role === 'SCHOOL_ADMIN') {
      const school = await this.prisma.school.findFirst({
        where: { id: student.schoolId, admins: { some: { id: req.user.sub } } },
        select: { id: true },
      });
      if (!school) throw new ForbiddenException('Not authorized for this school');
    }

    if (req.user.role === 'TUTOR') {
      const tutor = await this.prisma.tutor.findUnique({ where: { userId: req.user.sub }, select: { id: true } });
      const assignment = tutor
        ? await this.prisma.tutorAssignment.findFirst({
            where: {
              tutorId: tutor.id,
              schoolId: student.schoolId,
              className: student.className,
              isActive: true,
            },
            select: { id: true },
          })
        : null;
      if (!assignment) throw new ForbiddenException('Tutor not assigned to this class');
    }

    return this.studentsService.resetStudentPassword(student.id, req.user.sub);
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  create(@Body() body: any) {
    return this.studentsService.create(body);
  }

  @Post('bulk')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  bulkCreate(@Body('schoolId') schoolId: string, @Body('students') students: any[]) {
    return this.studentsService.bulkCreate(schoolId, students);
  }

  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.studentsService.update(id, body);
  }

  @Patch(':id/deactivate')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TUTOR')
  @ApiOperation({ summary: 'Deactivate a student (soft delete)' })
  async deactivate(@Param('id') id: string, @Request() req) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { id: true, schoolId: true, className: true, userId: true },
    });
    if (!student) throw new ForbiddenException('Student not found');

    if (req.user.role === 'SCHOOL_ADMIN') {
      const school = await this.prisma.school.findFirst({
        where: { id: student.schoolId, admins: { some: { id: req.user.sub } } },
        select: { id: true },
      });
      if (!school) throw new ForbiddenException('Not authorized for this school');
    }

    if (req.user.role === 'TUTOR') {
      const tutor = await this.prisma.tutor.findUnique({ where: { userId: req.user.sub }, select: { id: true } });
      const assignment = tutor
        ? await this.prisma.tutorAssignment.findFirst({
            where: {
              tutorId: tutor.id,
              schoolId: student.schoolId,
              className: student.className,
              isActive: true,
            },
            select: { id: true },
          })
        : null;
      if (!assignment) throw new ForbiddenException('Tutor not assigned to this class');
    }

    return this.studentsService.deactivate(student.id);
  }

  @Patch(':id/tutor-update')
  @Roles('TUTOR')
  @ApiOperation({ summary: 'Tutor update student name (assigned class only)' })
  async tutorUpdate(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { firstName?: string; lastName?: string; fullName?: string },
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { id: true, schoolId: true, className: true },
    });
    if (!student) throw new ForbiddenException('Student not found');

    const tutor = await this.prisma.tutor.findUnique({ where: { userId: req.user.sub }, select: { id: true } });
    const assignment = tutor
      ? await this.prisma.tutorAssignment.findFirst({
          where: {
            tutorId: tutor.id,
            schoolId: student.schoolId,
            className: student.className,
            isActive: true,
          },
          select: { id: true },
        })
      : null;
    if (!assignment) throw new ForbiddenException('Tutor not assigned to this class');

    const full = String(body?.fullName || '').trim().replace(/\s+/g, ' ');
    const parts = full ? full.split(' ') : [];
    const fn = String(body?.firstName || (parts[0] || '')).trim();
    const ln = String(body?.lastName || (parts.length > 1 ? parts.slice(1).join(' ') : '')).trim();

    return this.studentsService.updateStudentName(student.id, fn, ln);
  }

  @Post('bulk-csv')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'TUTOR')
  @ApiOperation({ summary: 'Bulk upload students from CSV text' })
  async bulkCsv(@Body() body: { csv: string; schoolId: string; defaults: any }, @Request() req) {
    if (req.user.role === 'SCHOOL_ADMIN') {
      const school = await this.prisma.school.findFirst({
        where: { id: body.schoolId, admins: { some: { id: req.user.sub } } },
        select: { id: true },
      });
      if (!school) throw new ForbiddenException('Not authorized for this school');
    }
    if (req.user.role === 'TUTOR') {
      const tutor = await this.prisma.tutor.findUnique({ where: { userId: req.user.sub }, select: { id: true } });
      const assignment = tutor
        ? await this.prisma.tutorAssignment.findFirst({
            where: {
              tutorId: tutor.id,
              schoolId: body.schoolId,
              className: body.defaults?.className,
              isActive: true,
            },
            select: { id: true },
          })
        : null;
      if (!assignment) throw new ForbiddenException('Tutor not assigned to this class');
    }
    return this.csvUpload.processCSV(body.csv, body.schoolId, body.defaults);
  }
}