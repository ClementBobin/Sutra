import {
  type ApiToken,
  type Prisma,
  type PrismaClient,
  type TokenShare,
  type User,
  type WebviewAccess,
  ShareAccessLevel,
  TokenScope,
  UserRole,
  WebviewAccessLevel
} from '@prisma/client';
import { z } from 'zod';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { generateApiToken } from '../../utils/auth.utils.js';

export interface ApiTokenWithRelations extends ApiToken {
  shares: TokenShare[];
}

export interface ApiTokenCreationPayload {
  token: string;
  tokenMeta: ApiTokenWithRelations;
}

const idSchema = z.string().min(1);
const createTokenSchema = z.object({
  appId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  scopes: z.array(z.nativeEnum(TokenScope)).min(1),
  expiresAt: z.string().datetime().optional().nullable(),
  sharedUserIds: z.array(z.string().min(1))
});
const updateTokenSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    scopes: z.array(z.nativeEnum(TokenScope)).min(1).optional()
  })
  .refine((value) => value.name !== undefined || value.description !== undefined || value.scopes !== undefined, {
    message: 'At least one field is required'
  });
const shareTokenSchema = z.object({
  tokenId: z.string().min(1),
  userId: z.string().min(1),
  accessLevel: z.nativeEnum(ShareAccessLevel)
});
const grantWebviewSchema = z.object({
  userId: z.string().min(1),
  level: z.nativeEnum(WebviewAccessLevel),
  enabled: z.boolean().optional()
});
const adminTokenFilterSchema = z
  .object({
    ownerId: z.string().min(1).optional(),
    includeRevoked: z.boolean().optional(),
    includeDisabled: z.boolean().optional()
  })
  .optional();

function normalizeExpiry(expiresAt: string | null | undefined): Date | null {
  if (expiresAt === undefined || expiresAt === null) {
    return null;
  }

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Invalid expiresAt value');
  }

  return date;
}

function isAdmin(user: Pick<User, 'role'>): boolean {
  return user.role === UserRole.ADMIN;
}

async function getTokenOrThrow(id: string, prisma: PrismaClient): Promise<ApiTokenWithRelations> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    throw new ValidationError('Invalid token id');
  }

  const token = await prisma.apiToken.findUnique({
    where: { id: parsedId.data },
    include: { shares: true }
  });

  if (!token) {
    throw new NotFoundError('Token not found');
  }

  return token;
}

async function assertTokenAdminOrOwner(token: ApiToken, userId: string, userRole: UserRole): Promise<void> {
  if (token.ownerId === userId || userRole === UserRole.ADMIN) {
    return;
  }
  throw new ForbiddenError('Only token owner or admin can perform this action');
}

async function assertTokenVisible(token: ApiTokenWithRelations, userId: string, userRole: UserRole): Promise<void> {
  if (token.ownerId === userId || userRole === UserRole.ADMIN) {
    return;
  }

  const share = token.shares.find((entry) => entry.userId === userId && !entry.disabled);
  if (!share) {
    throw new ForbiddenError('Token is not shared with you');
  }
}

async function ensureShareUsersExist(userIds: string[], prisma: PrismaClient): Promise<void> {
  if (userIds.length === 0) {
    return;
  }

  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
  const existing = new Set(users.map((user) => user.id));
  const missing = userIds.filter((id) => !existing.has(id));
  if (missing.length > 0) {
    throw new ValidationError(`Shared users not found: ${missing.join(', ')}`);
  }
}

export async function createApiToken(
  input: { appId: string; name: string; description?: string | null; scopes: TokenScope[]; expiresAt?: string | null; sharedUserIds: string[] },
  ownerId: string,
  prisma: PrismaClient
): Promise<ApiTokenCreationPayload> {
  const parsed = createTokenSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid token input');
  }

  const sharedUserIds = [...new Set(parsed.data.sharedUserIds.filter((id) => id !== ownerId))];
  await ensureShareUsersExist(sharedUserIds, prisma);

  const expiry = normalizeExpiry(parsed.data.expiresAt ?? null);
  const now = Date.now();
  if (expiry && expiry.getTime() <= now) {
    throw new ValidationError('Token expiration must be in the future');
  }

  const generated = generateApiToken();

  const created = await prisma.apiToken.create({
    data: {
      appId: parsed.data.appId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      scopes: parsed.data.scopes,
      expiresAt: expiry,
      ownerId,
      shares: sharedUserIds.length
        ? {
            create: sharedUserIds.map((userId) => ({
              userId,
              accessLevel: ShareAccessLevel.VIEWER
            }))
          }
        : undefined
    },
    include: { shares: true }
  });

  return {
    token: generated.rawToken,
    tokenMeta: created
  };
}

export async function getMyTokens(userId: string, includeRevoked: boolean, prisma: PrismaClient): Promise<ApiTokenWithRelations[]> {
  const parsedUserId = idSchema.safeParse(userId);
  if (!parsedUserId.success) {
    throw new ValidationError('Invalid user id');
  }

  return prisma.apiToken.findMany({
    where: {
      ownerId: parsedUserId.data,
      ...(includeRevoked ? {} : { revokedAt: null })
    },
    include: { shares: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getTokenById(id: string, requester: { id: string; role: UserRole }, prisma: PrismaClient): Promise<ApiTokenWithRelations> {
  const token = await getTokenOrThrow(id, prisma);
  await assertTokenVisible(token, requester.id, requester.role);
  return token;
}

export async function updateApiToken(
  id: string,
  input: { name?: string; description?: string | null; scopes?: TokenScope[] },
  requester: { id: string; role: UserRole },
  prisma: PrismaClient
): Promise<ApiTokenWithRelations> {
  const parsed = updateTokenSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid update input');
  }

  const token = await getTokenOrThrow(id, prisma);
  await assertTokenAdminOrOwner(token, requester.id, requester.role);

  return prisma.apiToken.update({
    where: { id: token.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      scopes: parsed.data.scopes
    },
    include: { shares: true }
  });
}

export async function extendApiToken(
  id: string,
  expiresAt: string | null | undefined,
  requester: { id: string; role: UserRole },
  prisma: PrismaClient
): Promise<ApiTokenWithRelations> {
  const token = await getTokenOrThrow(id, prisma);
  await assertTokenAdminOrOwner(token, requester.id, requester.role);

  const expiry = normalizeExpiry(expiresAt ?? null);
  if (expiry && expiry.getTime() <= Date.now()) {
    throw new ValidationError('Token expiration must be in the future');
  }

  return prisma.apiToken.update({
    where: { id: token.id },
    data: { expiresAt: expiry },
    include: { shares: true }
  });
}

export async function revokeApiToken(
  id: string,
  requester: { id: string; role: UserRole },
  prisma: PrismaClient
): Promise<{ success: boolean; message: string }> {
  const token = await getTokenOrThrow(id, prisma);
  await assertTokenAdminOrOwner(token, requester.id, requester.role);

  await prisma.apiToken.update({
    where: { id: token.id },
    data: { revokedAt: new Date() }
  });

  return {
    success: true,
    message: `Token ${token.id} revoked.`
  };
}

export async function toggleApiTokenEnabled(
  id: string,
  requester: { id: string; role: UserRole },
  prisma: PrismaClient
): Promise<ApiTokenWithRelations> {
  const token = await getTokenOrThrow(id, prisma);
  await assertTokenAdminOrOwner(token, requester.id, requester.role);

  return prisma.apiToken.update({
    where: { id: token.id },
    data: { disabled: !token.disabled },
    include: { shares: true }
  });
}

export async function shareToken(
  input: { tokenId: string; userId: string; accessLevel: ShareAccessLevel },
  requester: { id: string; role: UserRole },
  prisma: PrismaClient
): Promise<TokenShare> {
  const parsed = shareTokenSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid share token input');
  }

  const token = await getTokenOrThrow(parsed.data.tokenId, prisma);
  await assertTokenAdminOrOwner(token, requester.id, requester.role);

  if (parsed.data.userId === token.ownerId) {
    throw new ValidationError('Token owner is already authorized');
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) {
    throw new NotFoundError('Target user not found');
  }

  return prisma.tokenShare.upsert({
    where: {
      tokenId_userId: {
        tokenId: token.id,
        userId: parsed.data.userId
      }
    },
    create: {
      tokenId: token.id,
      userId: parsed.data.userId,
      accessLevel: parsed.data.accessLevel
    },
    update: {
      accessLevel: parsed.data.accessLevel,
      disabled: false
    }
  });
}

export async function removeTokenShare(
  tokenId: string,
  userId: string,
  requester: { id: string; role: UserRole },
  prisma: PrismaClient
): Promise<{ success: boolean; message: string }> {
  const parsedTokenId = idSchema.safeParse(tokenId);
  const parsedUserId = idSchema.safeParse(userId);
  if (!parsedTokenId.success || !parsedUserId.success) {
    throw new ValidationError('Invalid token or user id');
  }

  const token = await getTokenOrThrow(parsedTokenId.data, prisma);
  await assertTokenAdminOrOwner(token, requester.id, requester.role);

  await prisma.tokenShare.deleteMany({
    where: {
      tokenId: token.id,
      userId: parsedUserId.data
    }
  });

  return {
    success: true,
    message: `Share removed for user ${parsedUserId.data}.`
  };
}

export async function setTokenShareEnabled(
  tokenId: string,
  userId: string,
  enabled: boolean,
  requester: { id: string; role: UserRole },
  prisma: PrismaClient
): Promise<TokenShare> {
  const parsedTokenId = idSchema.safeParse(tokenId);
  const parsedUserId = idSchema.safeParse(userId);
  if (!parsedTokenId.success || !parsedUserId.success) {
    throw new ValidationError('Invalid token or user id');
  }

  const token = await getTokenOrThrow(parsedTokenId.data, prisma);
  await assertTokenAdminOrOwner(token, requester.id, requester.role);

  const share = await prisma.tokenShare.findUnique({
    where: {
      tokenId_userId: {
        tokenId: token.id,
        userId: parsedUserId.data
      }
    }
  });

  if (!share) {
    throw new NotFoundError('Share not found');
  }

  return prisma.tokenShare.update({
    where: { id: share.id },
    data: { disabled: !enabled }
  });
}

export async function getAdminTokens(
  filter: { ownerId?: string; includeRevoked?: boolean; includeDisabled?: boolean } | undefined,
  prisma: PrismaClient
): Promise<ApiTokenWithRelations[]> {
  const parsed = adminTokenFilterSchema.safeParse(filter);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid admin token filter');
  }

  const where: Prisma.ApiTokenWhereInput = {
    ownerId: parsed.data?.ownerId
  };

  if (!parsed.data?.includeRevoked) {
    where.revokedAt = null;
  }

  if (!parsed.data?.includeDisabled) {
    where.disabled = false;
  }

  return prisma.apiToken.findMany({
    where,
    include: { shares: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function adminSetTokenEnabled(id: string, enabled: boolean, prisma: PrismaClient): Promise<ApiTokenWithRelations> {
  const token = await getTokenOrThrow(id, prisma);

  return prisma.apiToken.update({
    where: { id: token.id },
    data: { disabled: !enabled },
    include: { shares: true }
  });
}

export async function grantWebviewAccess(
  input: { userId: string; level: WebviewAccessLevel; enabled?: boolean },
  grantedById: string,
  prisma: PrismaClient
): Promise<WebviewAccess> {
  const parsed = grantWebviewSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid webview access input');
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) {
    throw new NotFoundError('Target user not found');
  }

  return prisma.webviewAccess.upsert({
    where: { userId: parsed.data.userId },
    create: {
      userId: parsed.data.userId,
      level: parsed.data.level,
      enabled: parsed.data.enabled ?? true,
      grantedById
    },
    update: {
      level: parsed.data.level,
      enabled: parsed.data.enabled ?? true,
      grantedById
    }
  });
}

export async function setWebviewAccessEnabled(userId: string, enabled: boolean, prisma: PrismaClient): Promise<WebviewAccess> {
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) {
    throw new ValidationError('Invalid user id');
  }

  const access = await prisma.webviewAccess.findUnique({ where: { userId: parsed.data } });
  if (!access) {
    throw new NotFoundError('Webview access not found');
  }

  return prisma.webviewAccess.update({
    where: { id: access.id },
    data: { enabled }
  });
}

export async function removeWebviewAccess(userId: string, prisma: PrismaClient): Promise<{ success: boolean; message: string }> {
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) {
    throw new ValidationError('Invalid user id');
  }

  await prisma.webviewAccess.deleteMany({ where: { userId: parsed.data } });

  return {
    success: true,
    message: `Webview access removed for ${parsed.data}.`
  };
}

export async function getWebviewAccesses(requester: { id: string; role: UserRole }, prisma: PrismaClient): Promise<WebviewAccess[]> {
  if (isAdmin(requester)) {
    return prisma.webviewAccess.findMany({ orderBy: { createdAt: 'desc' } });
  }

  return prisma.webviewAccess.findMany({
    where: { userId: requester.id },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getTokenOwner(tokenId: string, prisma: PrismaClient): Promise<User> {
  const token = await prisma.apiToken.findUnique({ where: { id: tokenId } });
  if (!token) {
    throw new NotFoundError('Token not found');
  }

  const user = await prisma.user.findUnique({ where: { id: token.ownerId } });
  if (!user) {
    throw new NotFoundError('Owner not found');
  }

  return user;
}

export async function getTokenShares(tokenId: string, prisma: PrismaClient): Promise<TokenShare[]> {
  return prisma.tokenShare.findMany({ where: { tokenId }, orderBy: { createdAt: 'asc' } });
}

export async function getTokenShareUser(userId: string, prisma: PrismaClient): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}

export async function getWebviewAccessUser(userId: string, prisma: PrismaClient): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}
