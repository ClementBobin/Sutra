import { z } from 'zod';
import type { PrismaClient, Project } from '@prisma/client';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { applyPagination } from '../../utils/pagination.js';

const projectFilterSchema = z.object({ ownerId: z.string().min(1).optional() }).optional();
const createProjectSchema = z.object({ name: z.string().min(1), description: z.string().optional().nullable() });
const updateProjectSchema = z
  .object({ name: z.string().min(1).optional(), description: z.string().optional().nullable() })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'At least one field is required'
  });
const idSchema = z.string().min(1);

export async function getProjects(
  filter: { ownerId?: string } | undefined,
  pagination: { first?: number; after?: string },
  prisma: PrismaClient
): Promise<Project[]> {
  const parsedFilter = projectFilterSchema.safeParse(filter);
  if (!parsedFilter.success) {
    throw new ValidationError(parsedFilter.error.issues[0]?.message ?? 'Invalid project filter');
  }

  const paginationArgs = applyPagination(pagination);

  return prisma.project.findMany({
    where: parsedFilter.data,
    orderBy: { createdAt: 'asc' },
    ...paginationArgs
  });
}

export async function getProject(id: string, prisma: PrismaClient): Promise<Project> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    throw new ValidationError('Invalid project id');
  }

  const project = await prisma.project.findUnique({ where: { id: parsed.data } });
  if (!project) {
    throw new NotFoundError('Project not found');
  }

  return project;
}

export async function createProject(
  input: { name: string; description?: string | null },
  userId: string,
  prisma: PrismaClient
): Promise<Project> {
  const parsedInput = createProjectSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new ValidationError(parsedInput.error.issues[0]?.message ?? 'Invalid project input');
  }

  return prisma.project.create({
    data: {
      name: parsedInput.data.name,
      description: parsedInput.data.description ?? null,
      ownerId: userId
    }
  });
}

export async function updateProject(
  id: string,
  input: { name?: string; description?: string | null },
  userId: string,
  prisma: PrismaClient
): Promise<Project> {
  const parsedId = idSchema.safeParse(id);
  const parsedInput = updateProjectSchema.safeParse(input);

  if (!parsedId.success) {
    throw new ValidationError('Invalid project id');
  }

  if (!parsedInput.success) {
    throw new ValidationError(parsedInput.error.issues[0]?.message ?? 'Invalid update input');
  }

  const existing = await prisma.project.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    throw new NotFoundError('Project not found');
  }

  if (existing.ownerId !== userId) {
    throw new ForbiddenError('You can only update your own projects');
  }

  return prisma.project.update({
    where: { id: parsedId.data },
    data: parsedInput.data
  });
}

export async function deleteProject(
  id: string,
  userId: string,
  prisma: PrismaClient
): Promise<{ success: boolean; message: string }> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    throw new ValidationError('Invalid project id');
  }

  const existing = await prisma.project.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    throw new NotFoundError('Project not found');
  }

  if (existing.ownerId !== userId) {
    throw new ForbiddenError('You can only delete your own projects');
  }

  await prisma.project.delete({ where: { id: parsedId.data } });

  return {
    success: true,
    message: `Project ${parsedId.data} deleted successfully.`
  };
}

export async function getProjectOwner(projectId: string, prisma: PrismaClient) {
  const project = await getProject(projectId, prisma);
  return prisma.user.findUnique({ where: { id: project.ownerId } });
}
