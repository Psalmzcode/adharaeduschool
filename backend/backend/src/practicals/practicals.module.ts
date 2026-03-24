import { Module } from '@nestjs/common';
import { PracticalsController } from './practicals.controller';
import { PracticalsService } from './practicals.service';

@Module({
  controllers: [PracticalsController],
  providers: [PracticalsService],
  exports: [PracticalsService],
})
export class PracticalsModule {}
