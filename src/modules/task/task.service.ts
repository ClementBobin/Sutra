import { Priority, TaskStatus, type PrismaClient, type Task } from '@prisma/client';
import { z } from 'zod';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { applyPagination } from '../../utils/pagination.js';

const taskFilterSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    assigneeId: z.string().min(1).optional()
  })
  .optional();

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  priority: z.nativeEnum(Priority).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().min(1).optional().nullable()
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    dueDate: z.string().datetime().optional().nullable(),
    assigneeId: z.string().min(1).optional().nullable()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.status !== undefined ||
      value.priority !== undefined ||
      value.dueDate !== undefined ||
      value.assigneeId !== undefined,
    {
      message: 'At least one field must be provided'
    }
  );

const idSchema = z.string().min(1);

export async function getTasks(
  filter: { projectId?: string; status?: TaskStatus; priority?: Priority; assigneeId?: string } | undefined,
  pagination: { first?: number; after?: string },
  prisma: PrismaClient
): Promise<Task[]> {
  const parsedFilter = taskFilterSchema.safeParse(filter);
  if (!parsedFilter.success) {
    throw new ValidationError(parsedFilter.error.issues[0]?.message ?? 'Invalid task filter');
  }

  const paginationArgs = applyPagination(pagination);

  return prisma.task.findMany({
    where: parsedFilter.data,
    orderBy: { createdAt: 'asc' },
    ...paginationArgs
  });
}

export async function getTask(id: string, prisma: PrismaClient): Promise<Task> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    throw new ValidationError('Invalid task id');
  }

  const task = await prisma.task.findUnique({ where: { id: parsedId.data } });
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  return task;
}

async function ensureProjectOwnership(projectId: string, userId: string, prisma: PrismaClient): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError('Project not found');
  }

  if (project.ownerId !== userId) {
    throw new ForbiddenError('You can only manage tasks for your own projects');
  }
}

export async function createTask(
  input: { projectId: string; title: string; priority?: Priority; dueDate?: string | null; assigneeId?: string | null },
  userId: string,
  prisma: PrismaClient
): Promise<Task> {
  const parsedInput = createTaskSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new ValidationError(parsedInput.error.issues[0]?.message ?? 'Invalid create task input');
  }

  await ensureProjectOwnership(parsedInput.data.projectId, userId, prisma);

  return prisma.task.create({
    data: {
      projectId: parsedInput.data.projectId,
      title: parsedInput.data.title,
      priority: parsedInput.data.priority,
      dueDate: parsedInput.data.dueDate ? new Date(parsedInput.data.dueDate) : null,
      assigneeId: parsedInput.data.assigneeId ?? null
    }
  });
}

export async function updateTask(
  id: string,
  input: {
    title?: string;
    status?: TaskStatus;
    priority?: Priority;
    dueDate?: string | null;
    assigneeId?: string | null;
  },
  userId: string,
  prisma: PrismaClient
): Promise<Task> {
  const parsedId = idSchema.safeParse(id);
  const parsedInput = updateTaskSchema.safeParse(input);

  if (!parsedId.success) {
    throw new ValidationError('Invalid task id');
  }

  if (!parsedInput.success) {
    throw new ValidationError(parsedInput.error.issues[0]?.message ?? 'Invalid update task input');
  }

  const existing = await prisma.task.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    throw new NotFoundError('Task not found');
  }

  await ensureProjectOwnership(existing.projectId, userId, prisma);

  return prisma.task.update({
    where: { id: parsedId.data },
    data: {
      ...parsedInput.data,
      dueDate: parsedInput.data.dueDate === undefined ? undefined : parsedInput.data.dueDate ? new Date(parsedInput.data.dueDate) : null,
      assigneeId: parsedInput.data.assigneeId === undefined ? undefined : parsedInput.data.assigneeId
    }
  });
}

export async function deleteTask(
  id: string,
  userId: string,
  prisma: PrismaClient
): Promise<{ success: boolean; message: string }> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    throw new ValidationError('Invalid task id');
  }

  const existing = await prisma.task.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    throw new NotFoundError('Task not found');
  }

  await ensureProjectOwnership(existing.projectId, userId, prisma);

  await prisma.task.delete({ where: { id: parsedId.data } });

  return {
    success: true,
    message: `Task ${parsedId.data} deleted successfully.`
  };
}
