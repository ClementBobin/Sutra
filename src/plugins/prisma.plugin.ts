import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function prismaPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await fastify.prisma.$disconnect();
  });
}

export default fp(prismaPlugin);
