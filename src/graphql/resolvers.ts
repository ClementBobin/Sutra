import type { IResolvers } from 'mercurius';
import { userResolvers } from '../modules/user/user.resolvers.js';
import { projectResolvers } from '../modules/project/project.resolvers.js';
import { taskResolvers } from '../modules/task/task.resolvers.js';

const baseResolvers: IResolvers = {
  Query: {
    _health: () => 'ok'
  },
  Mutation: {
    _noop: () => 'ok'
  }
};

export const resolvers: IResolvers = {
  Query: {
    ...(baseResolvers.Query ?? {}),
    ...(userResolvers.Query ?? {}),
    ...(projectResolvers.Query ?? {}),
    ...(taskResolvers.Query ?? {})
  },
  Mutation: {
    ...(baseResolvers.Mutation ?? {}),
    ...(userResolvers.Mutation ?? {}),
    ...(projectResolvers.Mutation ?? {}),
    ...(taskResolvers.Mutation ?? {})
  },
  User: {
    ...(userResolvers.User ?? {})
  },
  Project: {
    ...(projectResolvers.Project ?? {})
  },
  Task: {
    ...(taskResolvers.Task ?? {})
  }
};
