import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EvidenceGradingModule } from '../evidence-grading/evidence-grading.module';
import { PracticalsController } from './practicals.controller';
import { PracticalsService } from './practicals.service';

@Module({
  imports: [ConfigModule, EvidenceGradingModule],
  controllers: [PracticalsController],
  providers: [PracticalsService],
  exports: [PracticalsService],
})
export class PracticalsModule {}