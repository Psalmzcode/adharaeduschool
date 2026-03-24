import { Controller, Get, Post, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard, TutorOnboardingGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TutorOnboardingGuard)
@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  // Get all conversations for current user
  @Get('conversations')
  getConversations(@Request() req) {
    return this.messagesService.getConversations(req.user.sub, req.user.role);
  }

  // Get unread count
  @Get('unread-count')
  getUnreadCount(@Request() req) {
    return this.messagesService.getUnreadCount(req.user.sub);
  }

  // ── Student ↔ student (same class) peer chat ─────────────────
  @Get('peer/conversations')
  getPeerConversations(@Request() req) {
    return this.messagesService.getPeerConversations(req.user.sub);
  }

  @Post('peer/conversations/start')
  startPeerConversation(@Request() req, @Body('targetUserId') targetUserId: string) {
    return this.messagesService.startPeerConversation(req.user.sub, targetUserId);
  }

  @Get('peer/conversations/:id')
  getPeerMessages(
    @Param('id') id: string,
    @Request() req,
    @Query('page') page?: string,
  ) {
    return this.messagesService.getPeerMessages(id, req.user.sub, page ? +page : 1);
  }

  @Post('peer/conversations/:id/send')
  sendPeerMessage(
    @Param('id') id: string,
    @Request() req,
    @Body('body') body: string,
  ) {
    return this.messagesService.sendPeerMessage(id, req.user.sub, body);
  }

  // Start a conversation (tutor → student, or student → tutor)
  @Post('conversations/start')
  startConversation(
    @Request() req,
    @Body('targetId') targetId: string,
    @Body('schoolId') schoolId: string,
  ) {
    return this.messagesService.startConversation(req.user.sub, req.user.role, targetId, schoolId);
  }

  // Get messages in a conversation
  @Get('conversations/:id')
  getMessages(
    @Param('id') id: string,
    @Request() req,
    @Query('page') page?: string,
  ) {
    return this.messagesService.getMessages(id, req.user.sub, page ? +page : 1);
  }

  // Send a message
  @Post('conversations/:id/send')
  sendMessage(
    @Param('id') id: string,
    @Request() req,
    @Body('body') body: string,
  ) {
    return this.messagesService.sendMessage(id, req.user.sub, body);
  }
}
