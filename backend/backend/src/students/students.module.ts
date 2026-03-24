// students.module.ts
import { Module } from '@nestjs/common';
import { CsvUploadService } from './csv-upload.service';
import { EmailModule } from '../email/email.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [EmailModule],
  controllers: [StudentsController],
  providers: [StudentsService, CsvUploadService],
  exports: [StudentsService, CsvUploadService],
})
export class StudentsModule {}
