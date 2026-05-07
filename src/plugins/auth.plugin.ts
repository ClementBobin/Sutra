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
