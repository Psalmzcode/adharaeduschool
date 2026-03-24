import { Controller, Get, Patch, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  getAll(@Request() req) {
    return this.notificationsService.getForUser(req.user.sub);
  }

  @Get('unread-count')
  getUnread(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Patch('mark-all-read')
  markAllRead(@Request() req) {
    return this.notificationsService.markAllRead(req.user.sub);
  }
}
