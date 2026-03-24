import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  // Get or create a conversation between a tutor and student
  async getOrCreateConversation(tutorId: string, studentId: string, schoolId: string) {
    const existing = await this.prisma.conversation.findUnique({
      where: { tutorId_studentId: { tutorId, studentId } },
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
        student: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: { tutorId, studentId, schoolId },
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
        student: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
    });
  }

  // Get all conversations for a user (tutor sees all their students, student sees their tutor)
  async getConversations(userId: string, role: string) {
    const where = role === 'TUTOR'
      ? { tutorId: userId }
      : role === 'STUDENT' || role === 'PARENT'
        ? { studentId: userId }
        : { OR: [{ tutorId: userId }, { studentId: userId }] };

    const convos = await this.prisma.conversation.findMany({
      where,
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        student: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { isRead: false, senderId: { not: userId } } } } },
      },
      orderBy: { lastAt: 'desc' },
    });

    return convos.map(c => ({
      ...c,
      unreadCount: c._count.messages,
      lastMessage: c.messages[0]?.body || c.lastMessage,
      lastMessageAt: c.messages[0]?.createdAt || c.lastAt,
    }));
  }

  // Get messages in a conversation
  async getMessages(conversationId: string, userId: string, page = 1, limit = 50) {
    const convo = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.tutorId !== userId && convo.studentId !== userId) throw new ForbiddenException();

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Mark unread messages as read
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });

    return messages;
  }

  // Send a message
  async sendMessage(conversationId: string, senderId: string, body: string) {
    const convo = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.tutorId !== senderId && convo.studentId !== senderId) throw new ForbiddenException();

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId, body },
        include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessage: body, lastAt: new Date() },
      }),
    ]);

    return message;
  }

  // Start conversation — tutor initiates or student initiates with their tutor
  async startConversation(initiatorId: string, initiatorRole: string, targetId: string, schoolId: string) {
    let tutorUserId: string;
    let studentUserId: string;
    let resolvedSchoolId: string;

    if (initiatorRole === 'TUTOR') {
      const student = await this.prisma.student.findUnique({
        where: { id: targetId },
        select: { userId: true, schoolId: true, className: true, track: true },
      });
      if (!student) throw new NotFoundException('Student not found');

      const tutor = await this.prisma.tutor.findUnique({
        where: { userId: initiatorId },
        select: { id: true },
      });
      if (!tutor) throw new ForbiddenException('Tutor profile not found');

      const teachesThisClass = await this.prisma.tutorAssignment.findFirst({
        where: {
          tutorId: tutor.id,
          schoolId: student.schoolId,
          className: student.className,
          track: student.track,
          isActive: true,
        },
        select: { id: true },
      });
      if (!teachesThisClass) {
        throw new ForbiddenException('You are not assigned to this student’s class');
      }

      tutorUserId = initiatorId;
      studentUserId = student.userId;
      resolvedSchoolId = student.schoolId;
    } else if (initiatorRole === 'STUDENT') {
      const student = await this.prisma.student.findUnique({
        where: { userId: initiatorId },
        select: { schoolId: true, className: true, track: true },
      });
      if (!student) throw new NotFoundException('Student profile not found');

      const assignment = await this.prisma.tutorAssignment.findFirst({
        where: {
          schoolId: student.schoolId,
          className: student.className,
          track: student.track,
          isActive: true,
        },
        include: { tutor: { select: { userId: true } } },
        orderBy: { startDate: 'desc' },
      });
      if (!assignment) {
        throw new NotFoundException('No tutor assigned to your class yet. Ask your school admin.');
      }

      tutorUserId = assignment.tutor.userId;
      studentUserId = initiatorId;
      resolvedSchoolId = student.schoolId;
    } else {
      throw new ForbiddenException('Messaging is only available for tutors and students');
    }

    const sid = (resolvedSchoolId || schoolId || '').trim();
    if (!sid) {
      throw new NotFoundException('Could not resolve school for this conversation');
    }

    return this.getOrCreateConversation(tutorUserId, studentUserId, sid);
  }

  // Get unread count for a user
  async getUnreadCount(userId: string) {
    const [tutorStudent, peer] = await Promise.all([
      this.prisma.message.count({
        where: {
          isRead: false,
          senderId: { not: userId },
          conversation: { OR: [{ tutorId: userId }, { studentId: userId }] },
        },
      }),
      this.prisma.peerMessage.count({
        where: {
          isRead: false,
          senderId: { not: userId },
          conversation: { OR: [{ userLowerId: userId }, { userHigherId: userId }] },
        },
      }),
    ]);
    return { count: tutorStudent + peer };
  }

  private sortPeerUserIds(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  async getPeerConversations(userId: string) {
    const rows = await this.prisma.peerConversation.findMany({
      where: { OR: [{ userLowerId: userId }, { userHigherId: userId }] },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastAt: 'desc' },
    });

    const peerIds = rows.map((c) => (c.userLowerId === userId ? c.userHigherId : c.userLowerId));
    if (peerIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: peerIds } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return Promise.all(
      rows.map(async (c) => {
        const pid = c.userLowerId === userId ? c.userHigherId : c.userLowerId;
        const unreadCount = await this.prisma.peerMessage.count({
          where: { conversationId: c.id, isRead: false, senderId: { not: userId } },
        });
        return {
          id: c.id,
          kind: 'peer' as const,
          peer: byId.get(pid) || { id: pid, firstName: '', lastName: '', avatarUrl: null },
          unreadCount,
          lastMessage: c.messages[0]?.body || c.lastMessage,
          lastMessageAt: c.messages[0]?.createdAt || c.lastAt,
        };
      }),
    );
  }

  async startPeerConversation(initiatorUserId: string, targetUserId: string) {
    const tid = String(targetUserId || '').trim();
    if (!tid) throw new BadRequestException('targetUserId is required');
    if (tid === initiatorUserId) throw new BadRequestException('Cannot chat with yourself');

    const [initiator, target] = await Promise.all([
      this.prisma.student.findUnique({
        where: { userId: initiatorUserId },
        select: { schoolId: true, className: true, user: { select: { role: true } } },
      }),
      this.prisma.student.findUnique({
        where: { userId: tid },
        select: { schoolId: true, className: true, user: { select: { role: true } } },
      }),
    ]);
    if (!initiator || !target) throw new NotFoundException('Student profile not found');
    if (initiator.user.role !== Role.STUDENT || target.user.role !== Role.STUDENT) {
      throw new ForbiddenException('Class chat is only between students');
    }
    if (initiator.schoolId !== target.schoolId || initiator.className !== target.className) {
      throw new ForbiddenException('You can only message students in your class');
    }

    const [low, high] = this.sortPeerUserIds(initiatorUserId, tid);
    const schoolId = initiator.schoolId;

    // upsert avoids unique-constraint races when two clients start the same chat at once
    const conv = await this.prisma.peerConversation.upsert({
      where: { userLowerId_userHigherId: { userLowerId: low, userHigherId: high } },
      create: { schoolId, userLowerId: low, userHigherId: high },
      update: {},
    });

    const peerId = conv.userLowerId === initiatorUserId ? conv.userHigherId : conv.userLowerId;
    const peer = await this.prisma.user.findUnique({
      where: { id: peerId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    return { id: conv.id, kind: 'peer' as const, peer };
  }

  async getPeerMessages(conversationId: string, userId: string, page = 1, limit = 50) {
    const convo = await this.prisma.peerConversation.findUnique({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.userLowerId !== userId && convo.userHigherId !== userId) throw new ForbiddenException();

    const messages = await this.prisma.peerMessage.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    await this.prisma.peerMessage.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });

    return messages;
  }

  async sendPeerMessage(conversationId: string, senderId: string, body: string) {
    const text = String(body || '').trim();
    if (!text) throw new BadRequestException('Message body is required');

    const convo = await this.prisma.peerConversation.findUnique({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.userLowerId !== senderId && convo.userHigherId !== senderId) throw new ForbiddenException();

    const [message] = await this.prisma.$transaction([
      this.prisma.peerMessage.create({
        data: { conversationId, senderId, body: text },
        include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      }),
      this.prisma.peerConversation.update({
        where: { id: conversationId },
        data: { lastMessage: text, lastAt: new Date() },
      }),
    ]);

    return message;
  }
}
