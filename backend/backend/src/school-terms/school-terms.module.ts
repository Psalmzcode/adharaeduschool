import { Module } from '@nestjs/common';
import { SchoolTermsController } from './school-terms.controller';
import { SchoolTermsService } from './school-terms.service';

@Module({
  controllers: [SchoolTermsController],
  providers: [SchoolTermsService],
  exports: [SchoolTermsService],
})
export class SchoolTermsModule {}
