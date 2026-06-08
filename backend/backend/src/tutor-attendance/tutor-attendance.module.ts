import { Module } from '@nestjs/common';
import { TutorAttendanceController } from './tutor-attendance.controller';
import { TutorAttendanceService } from './tutor-attendance.service';

@Module({
  controllers: [TutorAttendanceController],
  providers: [TutorAttendanceService],
  exports: [TutorAttendanceService],
})
export class TutorAttendanceModule {}
