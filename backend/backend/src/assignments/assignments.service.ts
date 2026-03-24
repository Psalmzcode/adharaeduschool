
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { findStudentByUserIdOrPk } from "../common/resolve-student";

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  // Tutor creates assignment for a class/module
  async create(tutorUserId: string, data: {
    moduleId: string; schoolId: string; className: string; classNames?: string[];
    title: string; description: string; dueDate: string; attachmentUrl?: string;
  }) {
    const classNames: string[] = Array.isArray(data.classNames)
      ? Array.from(new Set(data.classNames.map((c: any) => String(c || '').trim()).filter(Boolean)))
      : [];
    const targets: string[] = classNames.length ? classNames : [String(data.className || '').trim()].filter(Boolean);

    const createOne = (className: string) =>
      this.prisma.classAssignment.create({
        data: {
          tutorId: tutorUserId,
          schoolId: data.schoolId,
          className,
          moduleId: data.moduleId,
          title: data.title,
          description: data.description,
          dueDate: new Date(data.dueDate),
          attachmentUrl: data.attachmentUrl,
        },
        include: { school: { select: { name: true } } },
      });

    if (targets.length <= 1) {
      return createOne(targets[0] || data.className);
    }

    return this.prisma.$transaction(targets.map((className) => createOne(className)));
  }

  // Get assignments for a class
  async getForClass(schoolId: string, className: string) {
    return this.prisma.classAssignment.findMany({
      where: { className, schoolId, isPublished: true },
      include: {
        tutor: { select: { firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  // Student: get assignments for their class (pass User.id from JWT or Student.id)
  async getForStudent(studentIdOrUserId: string) {
    const student = await findStudentByUserIdOrPk(this.prisma, studentIdOrUserId);

    const assignments = await this.prisma.classAssignment.findMany({
      where: { className: student.className, schoolId: student.schoolId },
      include: {
        submissions: {
          where: { studentId: student.id },
          select: { id: true, status: true, score: true, submittedAt: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return assignments.map(a => ({
      ...a,
      submission: a.submissions[0] || null,
      isOverdue: new Date(a.dueDate) < new Date() && !a.submissions[0],
    }));
  }

  // Student: submit assignment (pass User.id from JWT or Student.id)
  async submit(assignmentId: string, studentIdOrUserId: string, fileUrl?: string, notes?: string) {
    const student = await findStudentByUserIdOrPk(this.prisma, studentIdOrUserId);
    const isLate = await this.prisma.classAssignment
      .findUnique({ where: { id: assignmentId }, select: { dueDate: true } })
      .then((a) => (a ? new Date() > new Date(a.dueDate) : false));
    return this.prisma.classAssignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
      create: {
        assignmentId,
        studentId: student.id,
        fileUrl,
        textBody: notes,
        status: isLate ? "LATE" : "SUBMITTED",
      },
      update: { fileUrl, textBody: notes, status: isLate ? "LATE" : "SUBMITTED", submittedAt: new Date() },
    });
  }

  // Tutor: grade a submission
  async grade(submissionId: string, grade: number, feedback: string) {
    return this.prisma.classAssignmentSubmission.update({
      where: { id: submissionId },
      data: { score: grade, feedback, status: "GRADED", gradedAt: new Date() },
    });
  }

  // All submissions for an assignment (for tutor marking)
  async getSubmissions(assignmentId: string) {
    return this.prisma.classAssignmentSubmission.findMany({
      where: { assignmentId },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { submittedAt: "desc" },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.classAssignment.update({
      where: { id },
      data: {
        ...data,
        dueDate: data?.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.classAssignment.delete({ where: { id } });
  }
}
