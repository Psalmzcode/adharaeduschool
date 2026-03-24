import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackLevel } from '@prisma/client';

@Injectable()
export class SchoolClassesService {
  constructor(private prisma: PrismaService) {}
  private readonly marker = '[[ADHARA_CLASSES_JSON]]';

  private extractStoredClasses(notes?: string | null): Array<{ className: string; track: TrackLevel }> {
    if (!notes) return [];
    const markerIndex = notes.indexOf(this.marker);
    if (markerIndex < 0) return [];
    const rawJson = notes.slice(markerIndex + this.marker.length).trim();
    if (!rawJson) return [];
    try {
      const parsed = JSON.parse(rawJson);
      return Array.isArray(parsed)
        ? parsed.filter((x: any) => x?.className && x?.track)
        : [];
    } catch {
      return [];
    }
  }

  private mergeNotesWithClasses(notes: string | null | undefined, classes: Array<{ className: string; track: TrackLevel }>) {
    const source = notes || '';
    const markerIndex = source.indexOf(this.marker);
    const plainNotes = markerIndex >= 0 ? source.slice(0, markerIndex).trimEnd() : source.trimEnd();
    const serialized = `${this.marker}${JSON.stringify(classes)}`;
    return plainNotes ? `${plainNotes}\n${serialized}` : serialized;
  }

  private async canAccessSchool(userId: string, role: string, schoolId: string) {
    if (role === 'SUPER_ADMIN') return true;

    if (role === 'SCHOOL_ADMIN') {
      const school = await this.prisma.school.findFirst({
        where: { id: schoolId, admins: { some: { id: userId } } },
        select: { id: true },
      });
      return !!school;
    }

    if (role === 'TUTOR') {
      const tutor = await this.prisma.tutor.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!tutor) return false;
      const assignment = await this.prisma.tutorAssignment.findFirst({
        where: { tutorId: tutor.id, schoolId, isActive: true },
        select: { id: true },
      });
      return !!assignment;
    }

    return false;
  }

  async findAll(schoolId: string, userId: string, role: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, notes: true } });
    if (!school) throw new NotFoundException('School not found');
    const allowed = await this.canAccessSchool(userId, role, schoolId);
    if (!allowed) throw new ForbiddenException('You do not have access to this school');

    const fromNotes = this.extractStoredClasses(school.notes);

    // Also derive classes from enrolled students so lists work even when admin never
    // registered classes in school notes (common with bulk CSV / seed data).
    const fromStudents = await this.prisma.student.findMany({
      where: { schoolId },
      select: { className: true, track: true },
      distinct: ['className', 'track'],
    });

    const byKey = new Map<string, { className: string; track: TrackLevel }>();
    for (const c of fromNotes) {
      byKey.set(`${c.className}::${c.track}`, { className: c.className, track: c.track });
    }
    for (const row of fromStudents) {
      const key = `${row.className}::${row.track}`;
      if (!byKey.has(key)) {
        byKey.set(key, { className: row.className, track: row.track });
      }
    }

    return Array.from(byKey.values()).sort((a, b) => a.className.localeCompare(b.className));
  }

  async create(
    data: { schoolId: string; className: string; track: TrackLevel },
    userId: string,
    role: string,
  ) {
    const allowed = await this.canAccessSchool(userId, role, data.schoolId);
    if (!allowed) throw new ForbiddenException('You do not have permission to create class for this school');

    const school = await this.prisma.school.findUnique({
      where: { id: data.schoolId },
      select: { id: true, notes: true },
    });
    if (!school) throw new NotFoundException('School not found');

    const className = data.className.trim().toUpperCase();
    const stored = this.extractStoredClasses(school.notes);
    const existingIndex = stored.findIndex((c) => c.className === className);
    if (existingIndex >= 0) {
      stored[existingIndex] = { className, track: data.track };
    } else {
      stored.push({ className, track: data.track });
    }

    await this.prisma.school.update({
      where: { id: data.schoolId },
      data: { notes: this.mergeNotesWithClasses(school.notes, stored) },
    });

    return {
      className,
      track: data.track,
      schoolId: data.schoolId,
    };
  }
}
