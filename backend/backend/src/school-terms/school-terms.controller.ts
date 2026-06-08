import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolTermsService } from './school-terms.service';
import { StartSchoolTermDto } from './dto/start-school-term.dto';

@ApiTags('School terms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard, RolesGuard)
@Controller('school-terms')
export class SchoolTermsController {
  constructor(private readonly schoolTermsService: SchoolTermsService) {}

  @Get('school/:schoolId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  list(@Request() req: { user: { sub: string; role: string } }, @Param('schoolId') schoolId: string) {
    return this.schoolTermsService.list(req.user.sub, req.user.role, schoolId);
  }

  @Post('school/:schoolId/start')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  start(
    @Request() req: { user: { sub: string; role: string } },
    @Param('schoolId') schoolId: string,
    @Body() dto: StartSchoolTermDto,
  ) {
    return this.schoolTermsService.startTerm(req.user.sub, req.user.role, schoolId, dto);
  }

  @Post('school/:schoolId/end')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  end(
    @Request() req: { user: { sub: string; role: string } },
    @Param('schoolId') schoolId: string,
  ) {
    return this.schoolTermsService.endTerm(req.user.sub, req.user.role, schoolId);
  }

  @Post('school/:schoolId/:termId/end')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  endOne(
    @Request() req: { user: { sub: string; role: string } },
    @Param('schoolId') schoolId: string,
    @Param('termId') termId: string,
  ) {
    return this.schoolTermsService.endTerm(req.user.sub, req.user.role, schoolId, termId);
  }
}
