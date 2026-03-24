import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Prisma connected on attempt ${attempt}.`);
        }
        return;
      } catch (error) {
        this.logger.warn(`Prisma connect attempt ${attempt} failed.`);
        if (attempt === maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
