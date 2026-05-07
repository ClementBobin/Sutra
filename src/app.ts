import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import mercurius, { type IResolvers } from 'mercurius';
import { config } from './config.js';
import prismaPlugin from './plugins/prisma.plugin.js';
import authPlugin from './plugins/auth.plugin.js';
import { schema } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import type { Context } from './graphql/context.js';

function mapStatusCode(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'extensions' in error) {
    const extensions = (error as { extensions?: { http?: { status?: number } } }).extensions;
    if (extensions?.http?.status && Number.isInteger(extensions.http.status)) {
      return extensions.http.status;
    }
  }

  return 500;
}

export async function buildApp() {
  const app = Fastify();

  await app.register(prismaPlugin);
  await app.register(authPlugin);

  await app.register(mercurius, {
    schema,
    resolvers: resolvers as IResolvers,
    context: (request: FastifyRequest): Context => ({
      prisma: app.prisma,
      user: request.user
    }),
    graphiql: config.NODE_ENV === 'development',
    queryDepth: 5,
    errorFormatter: (execution, _context) => {
      const firstError = execution.errors[0];
      const statusCode = firstError ? mapStatusCode(firstError) : 500;
      return {
        statusCode,
        response: execution
      };
    }
  });

  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: 'ok' });
  });

  return app;
}
