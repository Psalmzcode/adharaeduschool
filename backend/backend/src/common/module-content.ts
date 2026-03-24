import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ResolvedModuleRef = {
  moduleId: string;
  moduleNumber: number;
  moduleTitle: string;
  track: string;
};

export async function resolveModuleRef(prisma: PrismaService, moduleId?: string): Promise<ResolvedModuleRef> {
  const normalized = String(moduleId || '').trim();
  if (!normalized) {
    throw new BadRequestException('moduleId is required');
  }
  const module = await prisma.module.findUnique({
    where: { id: normalized },
    select: { id: true, number: true, title: true, track: true },
  });
  if (!module) {
    throw new BadRequestException('Selected module was not found');
  }
  return {
    moduleId: module.id,
    moduleNumber: module.number,
    moduleTitle: module.title,
    track: String(module.track),
  };
}

export function toLessonPlanTitle(ref: Pick<ResolvedModuleRef, 'moduleNumber' | 'moduleTitle'>) {
  return `Module ${ref.moduleNumber}: ${ref.moduleTitle}`;
}

export function toCbtTitle(ref: Pick<ResolvedModuleRef, 'moduleNumber' | 'moduleTitle'>) {
  return `Module ${ref.moduleNumber}: ${ref.moduleTitle} Assessment`;
}
