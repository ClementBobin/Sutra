import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyToken, type TokenPayload } from '../utils/auth.utils.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: TokenPayload | null;
  }
}

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', null);

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.user = null;
    const authorization = request.headers.authorization;

    if (!authorization) {
      return;
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return;
    }

    try {
      request.user = verifyToken(match[1]);
    } catch {
      request.user = null;
    }
  });
}

export default fp(authPlugin);
