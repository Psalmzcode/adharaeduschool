import { Injectable } from '@nestjs/common';
import { AcademicAuditAction, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditActor = { userId: string; role: Role | string };

@Injectable()
export class AcademicAuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    schoolId?: string | null;
    actor: AuditActor;
    action: AcademicAuditAction;
    className?: string;
    studentId?: string;
    moduleId?: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.academicAuditLog.create({
      data: {
        schoolId: params.schoolId || null,
        actorUserId: params.actor.userId,
        actorRole: params.actor.role as Role,
        action: params.action,
        className: params.className || null,
        studentId: params.studentId || null,
        moduleId: params.moduleId || null,
        summary: params.summary,
        metadata: (params.metadata ?? undefined) as any,
      },
    });
  }

  async listForSchool(schoolId: string, opts?: { limit?: number; className?: string }) {
    const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
    const where: { schoolId: string; className?: string } = { schoolId };
    if (opts?.className?.trim()) where.className = opts.className.trim();

    const rows = await this.prisma.academicAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const actorIds = [...new Set(rows.map((r) => r.actorUserId))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    return rows.map((r) => ({
      ...r,
      actor: actorMap.get(r.actorUserId) ?? null,
    }));
  }

  async listAll(limit = 200) {
    const take = Math.min(500, Math.max(1, limit));
    const rows = await this.prisma.academicAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        school: { select: { id: true, name: true, code: true } },
      },
    });

    const actorIds = [...new Set(rows.map((r) => r.actorUserId))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    return rows.map((r) => ({
      ...r,
      actor: actorMap.get(r.actorUserId) ?? null,
    }));
  }
}
