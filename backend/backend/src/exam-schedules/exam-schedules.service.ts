
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";

@Injectable()
export class ExamSchedulesService {
  private readonly logger = new Logger(ExamSchedulesService.name);

  constructor(private prisma: PrismaService, private email: EmailService) {}

  async create(createdBy: string, data: {
    cbtExamId: string; schoolId: string; className: string; classNames?: string[];
    scheduledAt: string; venue?: string; durationMins?: number;
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
          scheduledAt: new Date(data.scheduledAt),
          venue: data.venue,
          durationMins: data.durationMins || 60,
          createdBy,
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

  private async notifyStudents(schedule: any) {
    const students = await this.prisma.student.findMany({
      where: { schoolId: schedule.schoolId, className: schedule.className },
      include: { user: { select: { email: true, firstName: true } } },
    });

    for (const s of students) {
      // Create in-app notification
      await this.prisma.notification.create({
        data: {
          userId: s.userId,
          title: `Exam Scheduled: ${schedule.cbtExam.title}`,
          message: `Your exam has been scheduled for ${new Date(schedule.scheduledAt).toLocaleDateString("en-NG")} at ${schedule.venue || "Computer Lab"}`,
          link: "/dashboard/student#student-exams",
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
    return this.prisma.examSchedule.update({ where: { id }, data });
  }

  async cancel(id: string) {
    return this.prisma.examSchedule.update({ where: { id }, data: { status: "CANCELLED" } });
  }
}
