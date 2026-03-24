import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  findAll(query: { schoolId?: string; status?: any }) {
    return this.prisma.exam.findMany({
      where: query,
      include: { module: true, school: { select: { name: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { module: true, school: true, cbtExam: { include: { questions: { orderBy: { number: 'asc' } } } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  create(data: any) {
    return this.prisma.exam.create({ data, include: { module: true } });
  }

  update(id: string, data: any) {
    return this.prisma.exam.update({ where: { id }, data });
  }

  // Upcoming exams for a student's school
  async getUpcoming(schoolId: string) {
    return this.prisma.exam.findMany({
      where: { schoolId, scheduledAt: { gte: new Date() }, status: { not: 'CANCELLED' } },
      include: { module: true },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });
  }
}
