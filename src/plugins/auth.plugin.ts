import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, hashApiToken } from '../utils/auth.utils.js';
import type { TokenScope, UserRole } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string; role: UserRole } | null;
    tokenAuth: { tokenId: string; scopes: TokenScope[] } | null;
  }
}

const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_REQUESTS_PER_IP = 120;
const authWindowByIp = new Map<string, { count: number; resetAt: number }>();

function consumeAuthCheck(ip: string): boolean {
  const now = Date.now();
  const existing = authWindowByIp.get(ip);

  if (!existing || existing.resetAt <= now) {
    authWindowByIp.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return true;
  }

  if (existing.count >= AUTH_MAX_REQUESTS_PER_IP) {
    return false;
  }

  existing.count += 1;
  return true;
}

async function tryAuthenticateApiToken(request: FastifyRequest, token: string): Promise<boolean> {
  const tokenHash = hashApiToken(token);
  const foundToken = await request.server.prisma.apiToken.findUnique({
    where: { tokenHash },
    include: { owner: true }
  });

  if (!foundToken || !foundToken.owner) {
    return false;
  }

  const now = new Date();
  if (foundToken.disabled || foundToken.revokedAt !== null || (foundToken.expiresAt !== null && foundToken.expiresAt <= now)) {
    return false;
  }

  request.user = {
    id: foundToken.owner.id,
    email: foundToken.owner.email,
    role: foundToken.owner.role
  };
  request.tokenAuth = {
    tokenId: foundToken.id,
    scopes: foundToken.scopes
  };

  return true;
}

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('tokenAuth', null);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    request.user = null;
    request.tokenAuth = null;
    const authorization = request.headers.authorization;

    if (!authorization) {
      return;
    }

    const ip = request.ip || 'unknown';
    if (!consumeAuthCheck(ip)) {
      await reply.code(429).send({
        errors: [
          {
            message: 'Too many authentication attempts',
            extensions: { code: 'TOO_MANY_REQUESTS', http: { status: 429 } }
          }
        ]
      });
      return;
    }

    const bearerPrefix = 'bearer ';
    if (authorization.length <= bearerPrefix.length || authorization.slice(0, bearerPrefix.length).toLowerCase() !== bearerPrefix) {
      return;
    }

    const token = authorization.slice(bearerPrefix.length).trim();
    if (!token) {
      return;
    }

    try {
      const jwtPayload = verifyToken(token);
      const user = await request.server.prisma.user.findUnique({ where: { id: jwtPayload.id } });
      if (!user) {
        request.user = null;
        request.tokenAuth = null;
        return;
      }

      request.user = {
        id: user.id,
        email: user.email,
        role: user.role
      };
      return;
    } catch {
      const authenticated = await tryAuthenticateApiToken(request, token);
      if (!authenticated) {
        request.user = null;
        request.tokenAuth = null;
      }
    }
  });
}

export default fp(authPlugin);
