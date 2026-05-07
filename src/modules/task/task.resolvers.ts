import type { IResolvers } from 'mercurius';
import type { Context } from '../../graphql/context.js';
import { requireAuth } from '../../graphql/context.js';
import { me } from '../user/user.service.js';
import { getProject } from '../project/project.service.js';
import { createTask, deleteTask, getTask, getTasks, updateTask } from './task.service.js';

export const taskResolvers: IResolvers = {
  Query: {
    tasks: async (
      _parent: unknown,
      args: {
        filter?: { projectId?: string; status?: 'TODO' | 'IN_PROGRESS' | 'DONE'; priority?: 'LOW' | 'MEDIUM' | 'HIGH'; assigneeId?: string };
        first?: number;
        after?: string;
      },
      context: Context
    ) => {
      return getTasks(args.filter, { first: args.first, after: args.after }, context.prisma);
    },
    task: async (_parent: unknown, args: { id: string }, context: Context) => {
      return getTask(args.id, context.prisma);
    }
  },
  Mutation: {
    createTask: async (
      _parent: unknown,
      args: { input: { projectId: string; title: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH'; dueDate?: string; assigneeId?: string } },
      context: Context
    ) => {
      const user = requireAuth(context);
      return createTask(args.input, user.id, context.prisma);
    },
    updateTask: async (
      _parent: unknown,
      args: {
        id: string;
        input: {
          title?: string;
          status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
          priority?: 'LOW' | 'MEDIUM' | 'HIGH';
          dueDate?: string;
          assigneeId?: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);
      return updateTask(args.id, args.input, user.id, context.prisma);
    },
    deleteTask: async (_parent: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);
      return deleteTask(args.id, user.id, context.prisma);
    }
  },
  Task: {
    project: async (parent: { projectId: string }, _args: unknown, context: Context) => {
      return getProject(parent.projectId, context.prisma);
    },
    assignee: async (parent: { assigneeId?: string | null }, _args: unknown, context: Context) => {
      if (!parent.assigneeId) {
        return null;
      }
      return me(parent.assigneeId, context.prisma);
    }
  }
};
