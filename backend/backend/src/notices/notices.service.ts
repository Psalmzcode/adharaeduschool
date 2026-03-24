import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NoticesService {
  constructor(private prisma: PrismaService) {}

  findAll(schoolId: string) {
    return this.prisma.notice.findMany({
      where: { schoolId, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
      orderBy: { publishedAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.notice.findUnique({ where: { id } });
  }

  create(data: any) {
    return this.prisma.notice.create({ data });
  }

  update(id: string, data: any) {
    return this.prisma.notice.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.notice.delete({ where: { id } });
  }
}
