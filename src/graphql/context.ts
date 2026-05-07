import type { PrismaClient, TokenScope, UserRole } from '@prisma/client';
import { AuthenticationError, ForbiddenError } from '../utils/errors.js';

export interface ContextUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface ContextTokenAuth {
  tokenId: string;
  scopes: TokenScope[];
}

export interface Context {
  prisma: PrismaClient;
  user: ContextUser | null;
  tokenAuth: ContextTokenAuth | null;
}

export function requireAuth(context: Context): ContextUser {
  if (!context.user) {
    throw new AuthenticationError();
  }
  return context.user;
}

export function requireJwtUser(context: Context): ContextUser {
  const user = requireAuth(context);
  if (context.tokenAuth) {
    throw new ForbiddenError('API tokens cannot access this operation');
  }
  return user;
}

export function requireAdmin(context: Context): ContextUser {
  const user = requireJwtUser(context);
  if (user.role !== 'ADMIN') {
    throw new ForbiddenError('Admin access required');
  }
  return user;
}

export function requireScope(context: Context, requiredScope: TokenScope): ContextUser {
  const user = requireAuth(context);
  if (!context.tokenAuth) {
    return user;
  }

  if (!context.tokenAuth.scopes.includes(requiredScope)) {
    throw new ForbiddenError(`Missing required token scope: ${requiredScope}`);
  }

  return user;
}

export async function requireWebviewAccess(context: Context): Promise<ContextUser> {
  const user = requireJwtUser(context);
  if (user.role === 'ADMIN') {
    return user;
  }

  const access = await context.prisma.webviewAccess.findUnique({ where: { userId: user.id } });
  if (!access || !access.enabled) {
    throw new ForbiddenError('Webview access is disabled');
  }

  return user;
}
