import { Body, Controller, Get, Post, Param, Request, UseGuards, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

const CERT_AUTH_ROLES = ['SUPER_ADMIN', 'CURRICULUM_LEAD'] as const;

@ApiTags('Certificates')
@ApiBearerAuth()
@Controller('certificates')
export class CertificatesController {
  constructor(private certsService: CertificatesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles(...CERT_AUTH_ROLES)
  async all() {
    return this.certsService.findAll();
  }

  @Get('designs')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles(...CERT_AUTH_ROLES)
  designs() {
    return this.certsService.listTrackDesigns();
  }

  @Get('eligible')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles(...CERT_AUTH_ROLES)
  listEligible(
    @Query('schoolId') schoolId?: string,
    @Query('className') className?: string,
    @Query('track') track?: string,
  ) {
    return this.certsService.listEligible({ schoolId, className, track });
  }

  @Get('preview/:studentId/:track')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles(...CERT_AUTH_ROLES)
  preview(@Param('studentId') studentId: string, @Param('track') track: string) {
    return this.certsService.previewIssue(studentId, track.toUpperCase());
  }

  @Get('my-certificates')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles('STUDENT')
  async getMyCerts(@Request() req) {
    const prisma = (this.certsService as any).prisma;
    const student = await prisma.student.findUnique({ where: { userId: req.user.sub } });
    if (!student) return [];
    return this.certsService.findByStudent(student.id);
  }

  @Get('check-eligibility/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles('STUDENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'CURRICULUM_LEAD', 'TUTOR')
  checkEligibility(@Param('studentId') studentId: string) {
    return this.certsService.checkEligibility(studentId);
  }

  @Post('issue/:studentId/:track')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles(...CERT_AUTH_ROLES)
  issue(@Request() req, @Param('studentId') studentId: string, @Param('track') track: string) {
    return this.certsService.issueCertificate(studentId, track.toUpperCase(), { userId: req.user.sub, role: req.user.role });
  }

  @Post('bulk-issue')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles(...CERT_AUTH_ROLES)
  bulkIssue(
    @Request() req,
    @Body() body: { schoolId: string; className?: string; track?: string },
  ) {
    return this.certsService.bulkIssueEligible(body.schoolId, { userId: req.user.sub, role: req.user.role }, {
      className: body.className,
      track: body.track?.toUpperCase(),
    });
  }

  @Patch(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles(...CERT_AUTH_ROLES)
  revoke(@Param('id') id: string, @Request() req) {
    return this.certsService.revoke(id, { role: req.user.role, userId: req.user.sub });
  }

  @Get('verify/:serialNumber')
  verify(@Param('serialNumber') serialNumber: string) {
    return this.certsService.verify(serialNumber);
  }

  @Get('student/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'CURRICULUM_LEAD', 'TUTOR')
  getByStudent(@Param('studentId') studentId: string) {
    return this.certsService.findByStudent(studentId);
  }
}
