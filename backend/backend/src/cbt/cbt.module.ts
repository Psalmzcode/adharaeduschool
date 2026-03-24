// cbt.module.ts
import { Module } from '@nestjs/common';
import { CbtController } from './cbt.controller';
import { CbtService } from './cbt.service';
@Module({ controllers: [CbtController], providers: [CbtService], exports: [CbtService] })
export class CbtModule {}
