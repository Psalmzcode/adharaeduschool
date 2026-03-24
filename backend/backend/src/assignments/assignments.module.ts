
import { Module } from "@nestjs/common";
import { AssignmentsController } from "./assignments.controller";
import { AssignmentsService } from "./assignments.service";
import { EmailModule } from "../email/email.module";

@Module({ imports: [EmailModule], controllers: [AssignmentsController], providers: [AssignmentsService], exports: [AssignmentsService] })
export class AssignmentsModule {}
