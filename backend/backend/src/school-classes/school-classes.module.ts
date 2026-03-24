import { Module } from '@nestjs/common';
import { SchoolClassesController } from './school-classes.controller';
import { SchoolClassesService } from './school-classes.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SchoolClassesController],
  providers: [SchoolClassesService],
})
export class SchoolClassesModule {}
