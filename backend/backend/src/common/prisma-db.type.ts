import type { Prisma, PrismaClient } from '@prisma/client';

/** Use inside `prisma.$transaction` callbacks or with `PrismaService` for shared helpers. */
export type PrismaDb = PrismaClient | Prisma.TransactionClient;
