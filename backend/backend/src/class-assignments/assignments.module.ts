import { Module } from '@nestjs/common';
import { ClassAssignmentsController } from './assignments.controller';
import { ClassAssignmentsService } from './assignments.service';
@Module({ controllers: [ClassAssignmentsController], providers: [ClassAssignmentsService], exports: [ClassAssignmentsService] })
export class ClassAssignmentsModule {}
