import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PracticalsController } from './practicals.controller';
import { PracticalsService } from './practicals.service';

@Module({
  imports: [ConfigModule],
  controllers: [PracticalsController],
  providers: [PracticalsService],
  exports: [PracticalsService],
})
export class PracticalsModule {}
