import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailPreviewController } from './email-preview.controller';

@Global()
@Module({
  controllers: [EmailPreviewController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
