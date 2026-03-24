import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClassAssignmentsService } from './assignments.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('assignments')
export class ClassAssignmentsController {
  constructor(private service: ClassAssignmentsService, private prisma: PrismaService) {}

  /** Resolves JWT user → Student row, then class assignments (by school + class). */
  private async assignmentsForStudentRequest(req: { user: { sub: string } }) {
    const student = await this.prisma.student.findUnique({ where: { userId: req.user.sub } });
    if (!student) return [];
    return this.service.findByStudent(student.id);
  }

  @Get('my-assignments')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  getMyAssignments(@Request() req) {
    return this.assignmentsForStudentRequest(req);
  }

  /** Alias for frontend `assignmentsApi.mine()` — same as my-assignments. */
  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  getMine(@Request() req) {
    return this.assignmentsForStudentRequest(req);
  }

  @Get('tutor-assignments')
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  getTutorAssignments(@Request() req) {
    return this.service.findByTutor(req.user.sub);
  }

  @Get('class')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  getForClass(@Query('schoolId') schoolId: string, @Query('className') className: string) {
    return this.service.findByClass(schoolId, className);
  }

  @Get(':id/submissions')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  getSubmissions(@Param('id') id: string) {
    return this.service.findSubmissions(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('TUTOR')
  create(@Request() req, @Body() body: any) {
    return this.service.create(req.user.sub, body);
  }

  @Post(':id/submit')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  async submit(@Param('id') id: string, @Request() req, @Body() body: any) {
    const student = await this.prisma.student.findUnique({ where: { userId: req.user.sub } });
    if (!student) throw new Error('Student profile not found');
    return this.service.submit(id, student.id, body);
  }

  @Patch('submissions/:id/grade')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN')
  grade(@Param('id') id: string, @Body('score') score: number, @Body('feedback') feedback: string) {
    return this.service.grade(id, score, feedback);
  }
}
