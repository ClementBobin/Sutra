import type { Context } from '../../graphql/context.js';
import { requireAuth } from '../../graphql/context.js';
import { getTasks } from '../task/task.service.js';
import { createProject, deleteProject, getProject, getProjectOwner, getProjects, updateProject } from './project.service.js';

export const projectResolvers = {
  Query: {
    projects: async (
      _parent: unknown,
      args: { filter?: { ownerId?: string }; first?: number; after?: string },
      context: Context
    ) => {
      return getProjects(args.filter, { first: args.first, after: args.after }, context.prisma);
    },
    project: async (_parent: unknown, args: { id: string }, context: Context) => {
      return getProject(args.id, context.prisma);
    }
  },
  Mutation: {
    createProject: async (_parent: unknown, args: { input: { name: string; description?: string | null } }, context: Context) => {
      const user = requireAuth(context);
      return createProject(args.input, user.id, context.prisma);
    },
    updateProject: async (
      _parent: unknown,
      args: { id: string; input: { name?: string; description?: string | null } },
      context: Context
    ) => {
      const user = requireAuth(context);
      return updateProject(args.id, args.input, user.id, context.prisma);
    },
    deleteProject: async (_parent: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);
      return deleteProject(args.id, user.id, context.prisma);
    }
  },
  Project: {
    owner: async (parent: unknown, _args: unknown, context: Context) => {
      const source = parent as { id: string };
      return getProjectOwner(source.id, context.prisma);
    },
    tasks: async (parent: unknown, _args: unknown, context: Context) => {
      const source = parent as { id: string };
      return getTasks({ projectId: source.id }, {}, context.prisma);
    }
  }
};
