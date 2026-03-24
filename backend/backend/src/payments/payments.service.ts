import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  findAll(schoolId?: string) {
    return this.prisma.payment.findMany({
      where: schoolId ? { schoolId } : undefined,
      include: { school: { select: { name: true, state: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: any) {
    return this.prisma.payment.create({ data, include: { school: { select: { name: true } } } });
  }

  markPaid(id: string, receiptUrl?: string) {
    return this.prisma.payment.update({ where: { id }, data: { isPaid: true, paidAt: new Date(), receiptUrl } });
  }

  // Platform-wide revenue summary (super admin)
  async getSummary() {
    const all = await this.prisma.payment.findMany();
    const total = all.reduce((s, p) => s + p.amount, 0);
    const paid = all.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);
    const unpaid = total - paid;
    return { total, paid, unpaid, count: all.length, paidCount: all.filter((p) => p.isPaid).length };
  }
}
