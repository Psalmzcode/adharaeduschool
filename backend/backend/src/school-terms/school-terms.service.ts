import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, SchoolTermStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildTermLabel, parseTermOrdinalFromLabel } from '../common/term-label.util';
import { StartSchoolTermDto } from './dto/start-school-term.dto';

@Injectable()
export class SchoolTermsService {
  constructor(private prisma: PrismaService) {}

  private async assertSchoolAccess(userId: string, role: string, schoolId: string) {
    if (role === Role.SUPER_ADMIN) return;
    if (role === Role.SCHOOL_ADMIN) {
      const ok = await this.prisma.school.findFirst({
        where: { id: schoolId, admins: { some: { id: userId } } },
        select: { id: true },
      });
      if (!ok) throw new ForbiddenException('You do not manage this school');
      return;
    }
    throw new ForbiddenException();
  }

  /** Ensure at least one term row exists when school has legacy labels only. */
  async ensureBackfillFromSchool(schoolId: string) {
    const count = await this.prisma.schoolTerm.count({ where: { schoolId } });
    if (count > 0) return;

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { academicYearLabel: true, currentTermLabel: true, createdAt: true },
    });
    if (!school) return;

    const year = String(school.academicYearLabel || '').trim() || '2025/2026';
    const label =
      String(school.currentTermLabel || '').trim() || buildTermLabel(year, 2);
    const termOrdinal = parseTermOrdinalFromLabel(label) ?? 2;

    await this.prisma.schoolTerm.create({
      data: {
        schoolId,
        academicYearLabel: year,
        termOrdinal,
        label,
        status: SchoolTermStatus.ACTIVE,
        startedAt: school.createdAt ?? new Date(),
      },
    });
  }

  async list(userId: string, role: string, schoolId: string) {
    await this.assertSchoolAccess(userId, role, schoolId);
    await this.ensureBackfillFromSchool(schoolId);

    const terms = await this.prisma.schoolTerm.findMany({
      where: { schoolId },
      orderBy: [{ startedAt: 'desc' }],
    });

    const active = terms.find((t) => t.status === SchoolTermStatus.ACTIVE) ?? null;
    return { active, terms };
  }

  async startTerm(userId: string, role: string, schoolId: string, dto: StartSchoolTermDto) {
    await this.assertSchoolAccess(userId, role, schoolId);

    const label = buildTermLabel(dto.academicYearLabel, dto.termOrdinal);
    const cloneAssignments = dto.cloneTutorAssignments !== false;
    const updateStudents = dto.updateStudentTermLabels !== false;

    const existing = await this.prisma.schoolTerm.findUnique({
      where: { schoolId_label: { schoolId, label } },
    });
    if (existing?.status === SchoolTermStatus.ACTIVE) {
      throw new BadRequestException(`Term "${label}" is already active`);
    }
    if (existing?.status === SchoolTermStatus.ENDED) {
      throw new BadRequestException(`Term "${label}" already ended. Use a new academic year or term number.`);
    }

    const now = new Date();
    const previousActive = await this.prisma.schoolTerm.findMany({
      where: { schoolId, status: SchoolTermStatus.ACTIVE },
    });
    const previousLabel = previousActive[0]?.label;

    const assignmentsToClone = cloneAssignments
      ? await this.prisma.tutorAssignment.findMany({
          where: {
            schoolId,
            isActive: true,
            ...(previousLabel ? { termLabel: previousLabel } : {}),
          },
        })
      : [];

    const result = await this.prisma.$transaction(async (tx) => {
      if (previousActive.length) {
        await tx.schoolTerm.updateMany({
          where: { schoolId, status: SchoolTermStatus.ACTIVE },
          data: { status: SchoolTermStatus.ENDED, endedAt: now },
        });
        await tx.tutorAssignment.updateMany({
          where: { schoolId, isActive: true },
          data: { isActive: false, endDate: now },
        });
      }

      const term = await tx.schoolTerm.create({
        data: {
          schoolId,
          academicYearLabel: dto.academicYearLabel.trim(),
          termOrdinal: dto.termOrdinal,
          label,
          status: SchoolTermStatus.ACTIVE,
          startedAt: now,
        },
      });

      await tx.school.update({
        where: { id: schoolId },
        data: {
          academicYearLabel: dto.academicYearLabel.trim(),
          currentTermLabel: label,
        },
      });

      if (updateStudents) {
        await tx.student.updateMany({
          where: { schoolId },
          data: { termLabel: label },
        });
      }

      let clonedAssignments = 0;
      if (assignmentsToClone.length) {
        await tx.tutorAssignment.createMany({
          data: assignmentsToClone.map((a) => ({
            tutorId: a.tutorId,
            schoolId: a.schoolId,
            track: a.track,
            className: a.className,
            termLabel: label,
            track3Stack: a.track3Stack,
            expectedSessionsPerWeek: a.expectedSessionsPerWeek,
            isActive: true,
            startDate: now,
          })),
        });
        clonedAssignments = assignmentsToClone.length;
      }

      return { term, clonedAssignments, studentsUpdated: updateStudents };
    });

    return {
      message: `Started ${label}`,
      term: result.term,
      clonedTutorAssignments: result.clonedAssignments,
      studentTermLabelsUpdated: result.studentsUpdated,
    };
  }

  async endTerm(userId: string, role: string, schoolId: string, termId?: string) {
    await this.assertSchoolAccess(userId, role, schoolId);

    const term = termId
      ? await this.prisma.schoolTerm.findFirst({ where: { id: termId, schoolId } })
      : await this.prisma.schoolTerm.findFirst({
          where: { schoolId, status: SchoolTermStatus.ACTIVE },
          orderBy: { startedAt: 'desc' },
        });

    if (!term) throw new NotFoundException('No active term found for this school');
    if (term.status === SchoolTermStatus.ENDED) {
      throw new BadRequestException('This term is already ended');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.schoolTerm.update({
        where: { id: term.id },
        data: { status: SchoolTermStatus.ENDED, endedAt: now },
      }),
      this.prisma.tutorAssignment.updateMany({
        where: { schoolId, termLabel: term.label, isActive: true },
        data: { isActive: false, endDate: now },
      }),
    ]);

    return { message: `Ended ${term.label}`, term: { ...term, status: SchoolTermStatus.ENDED, endedAt: now } };
  }
}
