// tutors.module.ts
import { Module } from '@nestjs/common';
import { TutorsController } from './tutors.controller';
import { TutorsService } from './tutors.service';
@Module({ controllers: [TutorsController], providers: [TutorsService], exports: [TutorsService] })
export class TutorsModule {}
