import { Global, Module } from '@nestjs/common';
import { AcademicAuditController } from './academic-audit.controller';
import { AcademicAuditService } from './academic-audit.service';

@Global()
@Module({
  controllers: [AcademicAuditController],
  providers: [AcademicAuditService],
  exports: [AcademicAuditService],
})
export class AcademicAuditModule {}
