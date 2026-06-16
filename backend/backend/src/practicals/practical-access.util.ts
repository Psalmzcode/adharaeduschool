import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PracticalTaskAccessRef = {
  tutorId: string;
  schoolId: string;
};

/** Tutor must own the task; school admins may grade tasks in their school; super admins bypass. */
export async function assertPracticalGradingAccess(
  prisma: PrismaService,
  task: PracticalTaskAccessRef,
  userId: string,
  role?: string,
): Promise<void> {
  if (role === 'SUPER_ADMIN') return;

  if (role === 'SCHOOL_ADMIN') {
    const ok = await prisma.school.findFirst({
      where: { id: task.schoolId, admins: { some: { id: userId } } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('You do not manage this school');
    return;
  }

  if (role === 'TUTOR') {
    if (task.tutorId !== userId) {
      throw new ForbiddenException('You do not own this practical task');
    }
    return;
  }

  throw new ForbiddenException('Not allowed to access this practical');
}
