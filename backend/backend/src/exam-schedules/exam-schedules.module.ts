
import { Module } from "@nestjs/common";
import { ExamSchedulesController } from "./exam-schedules.controller";
import { ExamSchedulesService } from "./exam-schedules.service";
import { EmailModule } from "../email/email.module";

@Module({ imports: [EmailModule], controllers: [ExamSchedulesController], providers: [ExamSchedulesService], exports: [ExamSchedulesService] })
export class ExamSchedulesModule {}
