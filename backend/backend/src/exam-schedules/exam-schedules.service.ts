
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { v4 as uuidv4 } from "uuid";

function parseLagosScheduledAt(input: any): Date {
  if (!input) throw new BadRequestException('scheduledAt is required');
  // If frontend sends datetime-local string "YYYY-MM-DDTHH:mm", interpret as Africa/Lagos (UTC+1)
  // and store as an absolute UTC Date.
  if (typeof input === 'string') {
    const raw = input.trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const h = Number(m[4]);
      const min = Number(m[5]);
      const sec = Number(m[6] || 0);
      // Lagos is UTC+1: convert to UTC by subtracting 1 hour.
      const utc = new Date(Date.UTC(y, mo - 1, d, h - 1, min, sec, 0));
      if (!Number.isFinite(utc.getTime())) throw new BadRequestException('Invalid scheduledAt datetime');
      return utc;
    }
    const dt = new Date(raw);
    if (!Number.isFinite(dt.getTime())) throw new BadRequestException('Invalid scheduledAt datetime');
    return dt;
  }
  const dt = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(dt.getTime())) throw new BadRequestException('Invalid scheduledAt datetime');
  return dt;
}

@Injectable()
export class ExamSchedulesService {
  private readonly logger = new Logger(ExamSchedulesService.name);

  constructor(private prisma: PrismaService, private email: EmailService) {}

  async create(createdBy: string, data: {
    cbtExamId: string; schoolId: string; className: string; classNames?: string[];
    scheduledAt: string; venue?: string; durationMins?: number;
    /** When true, students see “submitted” but not score until tutor releases. Default false = immediate results. */
    awaitTutorResultRelease?: boolean;
  }) {
    const classNames: string[] = Array.isArray(data.classNames)
      ? Array.from(new Set(data.classNames.map((c: any) => String(c || '').trim()).filter(Boolean)))
      : [];
    const targets: string[] = classNames.length ? classNames : [String(data.className || '').trim()].filter(Boolean);

    const createOne = (className: string) =>
      this.prisma.examSchedule.create({
        data: {
          cbtExamId: data.cbtExamId,
          schoolId: data.schoolId,
          className,
          scheduledAt: parseLagosScheduledAt(data.scheduledAt),
          venue: data.venue,
          durationMins: data.durationMins || 60,
          createdBy,
          awaitTutorResultRelease: !!data.awaitTutorResultRelease,
        },
        include: {
          cbtExam: { select: { title: true, durationMins: true } },
          school: { select: { name: true } },
        },
      });

    if (targets.length <= 1) {
      const schedule = await createOne(targets[0] || data.className);
      this.notifyStudents(schedule).catch(() => {});
      return schedule;
    }

    const schedules = await this.prisma.$transaction(targets.map((className) => createOne(className)));
    schedules.forEach((schedule) => this.notifyStudents(schedule).catch(() => {}));
    return schedules;
  }

  private async notifyStudents(schedule: any, mode: "new" | "rescheduled" = "new") {
    const students = await this.prisma.student.findMany({
      where: { schoolId: schedule.schoolId, className: schedule.className },
      include: { user: { select: { email: true, firstName: true } } },
    });

    const title =
      mode === "rescheduled"
        ? `Exam rescheduled: ${schedule.cbtExam.title}`
        : `Exam Scheduled: ${schedule.cbtExam.title}`;
    const message =
      mode === "rescheduled"
        ? `${schedule.cbtExam.title} has a new date/time. Access code: ${String(schedule.accessCode || "").trim() || "use the last part of your reg. number"}. See My Exams.`
        : `Your exam has been scheduled for ${new Date(schedule.scheduledAt).toLocaleDateString("en-NG")} at ${schedule.venue || "Computer Lab"}`;

    for (const s of students) {
      // Create in-app notification
      await this.prisma.notification.create({
        data: {
          userId: s.userId,
          title,
          message,
            link: `/dashboard/student?section=student-exams&scheduleId=${encodeURIComponent(String(schedule.id))}`,
        },
      });
      // Send email reminder
      await this.email.sendExamReminder({
        email: s.user.email,
        firstName: s.user.firstName,
        examTitle: schedule.cbtExam.title,
        date: new Date(schedule.scheduledAt).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time: new Date(schedule.scheduledAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
        venue: schedule.venue || "Computer Lab",
        durationMins: schedule.durationMins,
        accessCode: schedule.accessCode || undefined,
        loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      });
    }
  }

  async getForSchool(schoolId: string) {
    return this.prisma.examSchedule.findMany({
      where: { schoolId },
      include: { cbtExam: { select: { title: true, durationMins: true, track: true } } },
      orderBy: { scheduledAt: "asc" },
    });
  }

  /**
   * Student/parent "My Exams" — JWT `sub` is **User.id**, not Student.id.
   * Superadmin vetting (`cbtExam.isVetted`) does **not** filter rows here; any linked CBT exam is returned.
   */
  async getMine(userId: string, role: string) {
    const cbtExamSelect = {
      title: true,
      durationMins: true,
      passScore: true,
      isVetted: true,
      isPublished: true,
    } as const;

    if (role === "PARENT") {
      const parent = await this.prisma.parent.findUnique({
        where: { userId },
        include: { children: true },
      });
      if (!parent?.children?.length) {
        this.logger.log(`mine: PARENT userId=${userId} → no children linked, 0 schedules`);
        return [];
      }
      const seen = new Set<string>();
      const merged: Awaited<ReturnType<ExamSchedulesService["listSchedulesForStudentRow"]>> = [];
      for (const child of parent.children) {
        const rows = await this.listSchedulesForStudentRow(child.schoolId, child.className, cbtExamSelect);
        for (const r of rows) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            merged.push(r);
          }
        }
      }
      merged.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
      this.logger.log(
        `mine: PARENT userId=${userId} children=${parent.children.length} mergedSchedules=${merged.length}`,
      );
      return merged;
    }

    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) {
      this.logger.warn(`mine: role=${role} userId=${userId} → no Student row (lookup is by userId, not student PK)`);
      throw new NotFoundException("Student not found");
    }

    const rows = await this.listSchedulesForStudentRow(student.schoolId, student.className, cbtExamSelect);
    this.logger.log(
      `mine: STUDENT userId=${userId} studentId=${student.id} schoolId=${student.schoolId} className=${student.className} ` +
        `schedules=${rows.length} (vetting/publish flags on cbtExam are included for debugging, not used as filters)`,
    );
    if (rows.length) {
      this.logger.debug(
        rows.map((r) => ({
          scheduleId: r.id,
          title: r.cbtExam?.title,
          isVetted: r.cbtExam?.isVetted,
          isPublished: r.cbtExam?.isPublished,
        })),
      );
    }
    return rows;
  }

  private listSchedulesForStudentRow(
    schoolId: string,
    className: string,
    cbtExamSelect: { title: true; durationMins: true; passScore: true; isVetted: true; isPublished: true },
  ) {
    return this.prisma.examSchedule.findMany({
      where: { schoolId, className, isActive: true },
      include: { cbtExam: { select: cbtExamSelect } },
      orderBy: { scheduledAt: "asc" },
    });
  }

  async update(id: string, data: any) {
    const patch: any = { ...(data || {}) };
    delete patch.resultsReleasedAt;
    let rescheduled = false;
    if (patch.scheduledAt !== undefined && patch.scheduledAt !== null && patch.scheduledAt !== "") {
      if (typeof patch.scheduledAt === "string") {
        patch.scheduledAt = parseLagosScheduledAt(patch.scheduledAt);
      }
      patch.accessCode = uuidv4().split("-")[0].toUpperCase();
      rescheduled = true;
    }
    const updated = await this.prisma.examSchedule.update({
      where: { id },
      data: patch,
      include: {
        cbtExam: { select: { title: true, durationMins: true } },
        school: { select: { name: true } },
      },
    });
    if (rescheduled) {
      this.notifyStudents(updated, "rescheduled").catch(() => {});
    }
    return updated;
  }

  async cancel(id: string) {
    return this.prisma.examSchedule.update({ where: { id }, data: { status: "CANCELLED" } });
  }

  /** Tutor/admin: set `resultsReleasedAt` so students can see scores (when awaitTutorResultRelease was used). */
  async releaseResults(scheduleId: string, userId: string, role: string) {
    const schedule = await this.prisma.examSchedule.findUnique({
      where: { id: scheduleId },
      include: { cbtExam: { select: { tutorId: true, title: true } }, school: { select: { id: true } } },
    });
    if (!schedule) throw new NotFoundException("Schedule not found");

    if (role === "TUTOR") {
      const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
      if (!tutor || tutor.id !== schedule.cbtExam.tutorId) {
        throw new ForbiddenException("Only the exam’s tutor can release results");
      }
    } else if (role === "SCHOOL_ADMIN") {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
      if (!u?.schoolId || u.schoolId !== schedule.schoolId) {
        throw new ForbiddenException("Not allowed for this school");
      }
    } else if (role !== "SUPER_ADMIN") {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.examSchedule.update({
      where: { id: scheduleId },
      data: { resultsReleasedAt: new Date() },
      include: {
        cbtExam: { select: { title: true, durationMins: true } },
        school: { select: { name: true } },
      },
    });

    if (updated.awaitTutorResultRelease) {
      this.notifyResultsReleased(updated).catch(() => {});
    }
    return updated;
  }

  private async notifyResultsReleased(schedule: any) {
    const students = await this.prisma.student.findMany({
      where: { schoolId: schedule.schoolId, className: schedule.className },
      include: { user: { select: { id: true } } },
    });
    for (const s of students) {
      await this.prisma.notification.create({
        data: {
          userId: s.userId,
          title: `Results ready: ${schedule.cbtExam.title}`,
          message: `You can now view your score for ${schedule.cbtExam.title}. Open My Exams.`,
          link: `/dashboard/student?section=student-exams&scheduleId=${encodeURIComponent(String(schedule.id))}`,
        },
      });
    }
  }
}
