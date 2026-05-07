import type { Context } from '../../graphql/context.js';
import { requireAuth } from '../../graphql/context.js';
import { signToken } from '../../utils/auth.utils.js';
import { getUserAssignedTasks, getUserOwnedProjects, login, me, register } from './user.service.js';

export const userResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, context: Context) => {
      const user = requireAuth(context);
      return me(user.id, context.prisma);
    }
  },
  Mutation: {
    register: async (_parent: unknown, args: { input: { name: string; email: string; password: string } }, context: Context) => {
      return register(args.input, context.prisma);
    },
    login: async (_parent: unknown, args: { email: string; password: string }, context: Context) => {
      return login(args.email, args.password, context.prisma);
    },
    refreshToken: async (_parent: unknown, _args: unknown, context: Context) => {
      const user = requireAuth(context);
      const fullUser = await me(user.id, context.prisma);
      const token = signToken({ id: fullUser.id, email: fullUser.email });
      return {
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        user: fullUser
      };
    }
  },
  User: {
    ownedProjects: async (parent: unknown, _args: unknown, context: Context) => {
      const source = parent as { id: string };
      return getUserOwnedProjects(source.id, context.prisma);
    },
    assignedTasks: async (parent: unknown, _args: unknown, context: Context) => {
      const source = parent as { id: string };
      return getUserAssignedTasks(source.id, context.prisma);
    }
  }
};
