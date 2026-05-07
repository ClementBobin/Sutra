import { userResolvers } from '../modules/user/user.resolvers.js';
import { projectResolvers } from '../modules/project/project.resolvers.js';
import { taskResolvers } from '../modules/task/task.resolvers.js';

export const resolvers = {
  Query: {
    _health: () => 'ok',
    ...userResolvers.Query,
    ...projectResolvers.Query,
    ...taskResolvers.Query
  },
  Mutation: {
    _noop: () => 'ok',
    ...userResolvers.Mutation,
    ...projectResolvers.Mutation,
    ...taskResolvers.Mutation
  },
  User: {
    ...userResolvers.User
  },
  Project: {
    ...projectResolvers.Project
  },
  Task: {
    ...taskResolvers.Task
  }
};
