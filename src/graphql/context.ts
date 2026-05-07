import type { PrismaClient } from '@prisma/client';
import { AuthenticationError } from '../utils/errors.js';

export interface Context {
  prisma: PrismaClient;
  user: { id: string; email: string } | null;
}

export function requireAuth(context: Context): { id: string; email: string } {
  if (!context.user) {
    throw new AuthenticationError();
  }
  return context.user;
}
