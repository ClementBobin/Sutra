import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { PrismaClient, User } from '@prisma/client';
import { signToken } from '../../utils/auth.utils.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../../utils/errors.js';

export interface AuthPayload {
  token: string;
  expiresAt: string;
  user: User;
}

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const idSchema = z.string().min(1);

function getExpiresAtIso(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return date.toISOString();
}

export async function register(
  input: { name: string; email: string; password: string },
  prisma: PrismaClient
): Promise<AuthPayload> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid register input');
  }

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) {
    throw new ValidationError('Email is already in use');
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword
    }
  });

  const token = signToken({ id: user.id, email: user.email });
  return { token, expiresAt: getExpiresAtIso(), user };
}

export async function login(email: string, password: string, prisma: PrismaClient): Promise<AuthPayload> {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid login input');
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  const isValid = await bcrypt.compare(parsed.data.password, user.password);
  if (!isValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  const token = signToken({ id: user.id, email: user.email });
  return { token, expiresAt: getExpiresAtIso(), user };
}

export async function me(userId: string, prisma: PrismaClient): Promise<User> {
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) {
    throw new ValidationError('Invalid user id');
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

export async function getUserOwnedProjects(userId: string, prisma: PrismaClient) {
  return prisma.project.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' } });
}

export async function getUserAssignedTasks(userId: string, prisma: PrismaClient) {
  return prisma.task.findMany({ where: { assigneeId: userId }, orderBy: { createdAt: 'asc' } });
}
