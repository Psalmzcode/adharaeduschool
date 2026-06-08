import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';
import { AcademicAuditService } from './academic-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Academic audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard, RolesGuard)
@Controller('academic-audit')
export class AcademicAuditController {
  constructor(
    private readonly auditService: AcademicAuditService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async list(
    @Request() req: { user: { sub: string; role: string } },
    @Query('schoolId') schoolId?: string,
    @Query('className') className?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 100;
    if (req.user.role === 'SCHOOL_ADMIN') {
      const school = await this.prisma.school.findFirst({
        where: { admins: { some: { id: req.user.sub } } },
        select: { id: true },
      });
      if (!school) throw new ForbiddenException();
      return this.auditService.listForSchool(school.id, { limit: lim, className });
    }
    if (schoolId) {
      return this.auditService.listForSchool(schoolId, { limit: lim, className });
    }
    return this.auditService.listAll(lim);
  }
}
