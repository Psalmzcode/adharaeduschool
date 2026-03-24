import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * JWT payload `sub` is **User.id**. `Student.id` is a separate primary key.
 * Use this when a route passes `req.user.sub` but the service expects a student row.
 */
export async function findStudentByUserIdOrPk(
  prisma: PrismaService,
  userIdOrStudentPk: string,
  select: {
    id: boolean;
    className?: boolean;
    schoolId?: boolean;
    track?: boolean;
    userId?: boolean;
  } = { id: true, className: true, schoolId: true, track: true },
) {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: userIdOrStudentPk }, { userId: userIdOrStudentPk }] },
    select,
  });
  if (!student) throw new NotFoundException('Student not found');
  return student;
}
