import { Controller, Get, Post, Param, Request, UseGuards, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Certificates')
@ApiBearerAuth()
@Controller('certificates')
export class CertificatesController {
  constructor(private certsService: CertificatesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async all(@Request() req) {
    if (req.user.role === 'SCHOOL_ADMIN') {
      const prisma = (this.certsService as any).prisma;
      const school = await prisma.school.findFirst({
        where: { admins: { some: { id: req.user.sub } } },
        select: { id: true },
      });
      return this.certsService.findAll(school?.id);
    }
    return this.certsService.findAll();
  }

  @Get('my-certificates')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles('STUDENT')
  async getMyCerts(@Request() req) {
    // Get student id from user
    const prisma = (this.certsService as any).prisma;
    const student = await prisma.student.findUnique({ where: { userId: req.user.sub } });
    if (!student) return [];
    return this.certsService.findByStudent(student.id);
  }

  @Get('check-eligibility/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles('STUDENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  checkEligibility(@Param('studentId') studentId: string) {
    return this.certsService.checkEligibility(studentId);
  }

  @Post('issue/:studentId/:track')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  issue(@Param('studentId') studentId: string, @Param('track') track: string) {
    return this.certsService.issueCertificate(studentId, track);
  }

  @Patch(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  revoke(@Param('id') id: string, @Request() req) {
    return this.certsService.revoke(id, { role: req.user.role, userId: req.user.sub });
  }

  @Get('verify/:serialNumber')
  verify(@Param('serialNumber') serialNumber: string) {
    return this.certsService.verify(serialNumber);
  }

  @Get('student/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard, TutorOnboardingGuard)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'TUTOR')
  getByStudent(@Param('studentId') studentId: string) {
    return this.certsService.findByStudent(studentId);
  }
}
