import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

// JWT guard
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// Roles guard
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Tutor may access route while onboarding is still DRAFT (KYC draft, uploads, auth me). */
export const ALLOW_INCOMPLETE_TUTOR_PROFILE_KEY = 'allowIncompleteTutorProfile';
export const AllowIncompleteTutorProfile = () => SetMetadata(ALLOW_INCOMPLETE_TUTOR_PROFILE_KEY, true);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!required.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

/** Block tutors from dashboard APIs until onboardingStatus === COMPLETE */
@Injectable()
export class TutorOnboardingGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowIncomplete = this.reflector.getAllAndOverride<boolean>(ALLOW_INCOMPLETE_TUTOR_PROFILE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowIncomplete) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user || user.role !== 'TUTOR') return true;

    const tutor = await this.prisma.tutor.findUnique({
      where: { userId: user.sub },
      select: { onboardingStatus: true },
    });
    if (!tutor || tutor.onboardingStatus === 'COMPLETE') return true;

    throw new ForbiddenException({
      message: 'Complete your tutor profile to access the dashboard.',
      code: 'TUTOR_PROFILE_INCOMPLETE',
    });
  }
}
