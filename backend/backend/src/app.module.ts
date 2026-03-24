import { Module } from '@nestjs/common';
import { TutorOnboardingModule } from './auth/tutor-onboarding.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SchoolsModule } from './schools/schools.module';
import { StudentsModule } from './students/students.module';
import { TutorsModule } from './tutors/tutors.module';
import { ModulesModule } from './modules/modules.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ExamsModule } from './exams/exams.module';
import { CbtModule } from './cbt/cbt.module';
import { ReportsModule } from './reports/reports.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NoticesModule } from './notices/notices.module';
import { PaymentsModule } from './payments/payments.module';
import { MessagesModule } from './messages/messages.module';
import { LessonsModule } from './lessons/lessons.module';
import { CertificatesModule } from './certificates/certificates.module';
import { PaystackModule } from './paystack/paystack.module';
import { ClassAssignmentsModule } from './class-assignments/assignments.module';
import { SessionsModule } from './sessions/sessions.module';
import { ExamSchedulerModule } from './exam-scheduler/exam-scheduler.module';
import { ExamSchedulesModule } from './exam-schedules/exam-schedules.module';
import { PayrollModule } from './payroll/payroll.module';
import { SchoolClassesModule } from './school-classes/school-classes.module';
import { TracksModule } from './tracks/tracks.module';
import { PracticalsModule } from './practicals/practicals.module';
import { ClassPerformanceModule } from './class-performance/class-performance.module';

@Module({
  imports: [
    TutorOnboardingModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PrismaModule,
    EmailModule,           // Global — available everywhere
    AuthModule, UsersModule, SchoolsModule, StudentsModule, TutorsModule,
    ModulesModule, AttendanceModule, ExamsModule, CbtModule, ReportsModule,
    UploadsModule, NotificationsModule, NoticesModule, PaymentsModule,
    MessagesModule, LessonsModule, CertificatesModule, PaystackModule,
    ClassAssignmentsModule, SessionsModule, ExamSchedulerModule, ExamSchedulesModule, PayrollModule,
    SchoolClassesModule,
    TracksModule,
    PracticalsModule,
    ClassPerformanceModule,
  ],
})
export class AppModule {}
