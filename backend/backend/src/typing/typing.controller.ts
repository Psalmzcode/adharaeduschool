import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/guards/jwt-auth.guard';
import { TypingService } from './typing.service';

@ApiTags('Typing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('typing')
export class TypingController {
  constructor(private readonly service: TypingService) {}

  @Get('drills')
  @UseGuards(RolesGuard)
  @Roles('STUDENT', 'TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  drills() {
    return this.service.listDrills();
  }

  @Get('access')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  access(@Request() req) {
    return this.service.getStudentTypingLabAccess(req.user.sub);
  }

  @Get('my-summary')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  mySummary(@Request() req, @Query('moduleId') moduleId?: string) {
    return this.service.mySummary(req.user.sub, moduleId);
  }

  @Get('feedback')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  feedback(@Request() req, @Query('moduleId') moduleId?: string) {
    return this.service.myFeedback(req.user.sub, moduleId);
  }

  @Post('attempts')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  saveAttempt(
    @Request() req,
    @Body() body: { moduleId: string; drillKey: string; typed: string; elapsedSec: number },
  ) {
    return this.service.saveAttempt(req.user.sub, body);
  }

  @Get('class-summary')
  @UseGuards(RolesGuard)
  @Roles('TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  classSummary(
    @Query('schoolId') schoolId: string,
    @Query('className') className: string,
    @Query('moduleId') moduleId?: string,
  ) {
    return this.service.classSummary(schoolId, className, moduleId);
  }
}
