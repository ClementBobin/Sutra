import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, type TokenPayload } from '../utils/auth.utils.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: TokenPayload | null;
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

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', null);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    request.user = null;
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
      request.user = verifyToken(token);
    } catch {
      request.user = null;
    }
  });
}

export default fp(authPlugin);
