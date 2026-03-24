import { Module } from '@nestjs/common';
import { ClassPerformanceController } from './class-performance.controller';
import { ClassPerformanceService } from './class-performance.service';

@Module({
  controllers: [ClassPerformanceController],
  providers: [ClassPerformanceService],
})
export class ClassPerformanceModule {}
