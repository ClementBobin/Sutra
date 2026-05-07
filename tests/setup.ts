import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '4001';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '24h';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/sutra_test';

export let app: FastifyInstance;
export let prisma: PrismaClient;

beforeAll(async () => {
  const { buildApp } = await import('/home/runner/work/Sutra/Sutra/src/app.ts');
  app = await buildApp();
  await app.ready();
  prisma = app.prisma;
});

afterEach(async () => {
  await prisma.$transaction([
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany()
  ]);
});

afterAll(async () => {
  await app.close();
});
