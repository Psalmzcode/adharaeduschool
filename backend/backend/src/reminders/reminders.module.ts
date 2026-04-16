import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [RemindersService, PrismaService],
})
export class RemindersModule {}

