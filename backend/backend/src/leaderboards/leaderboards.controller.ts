import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TrackLevel } from '@prisma/client';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/guards/jwt-auth.guard';
import { LeaderboardScope, LeaderboardsService } from './leaderboards.service';

@ApiTags('Leaderboards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly service: LeaderboardsService) {}

  @Get('filters')
  @Roles('STUDENT', 'TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  filters(@Request() req) {
    return this.service.getFilters(req.user);
  }

  @Get()
  @Roles('STUDENT', 'TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  leaderboard(
    @Request() req,
    @Query('track') track?: TrackLevel,
    @Query('scope') scope?: LeaderboardScope,
    @Query('schoolId') schoolId?: string,
    @Query('className') className?: string,
    @Query('crossSchool') crossSchool?: string,
  ) {
    return this.service.getLeaderboard(req.user, {
      track,
      scope,
      schoolId,
      className,
      crossSchool: crossSchool === 'true' || crossSchool === '1',
    });
  }
}
