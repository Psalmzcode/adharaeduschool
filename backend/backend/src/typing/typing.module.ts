import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TypingController } from './typing.controller';
import { TypingService } from './typing.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [TypingController],
  providers: [TypingService],
  exports: [TypingService],
})
export class TypingModule {}
