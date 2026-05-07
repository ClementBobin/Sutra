import { userTypeDefs } from '../modules/user/user.typedefs.js';
import { projectTypeDefs } from '../modules/project/project.typedefs.js';
import { taskTypeDefs } from '../modules/task/task.typedefs.js';

export const schema = `
  type Query {
    _health: String
  }

  type Mutation {
    _noop: String
  }

  ${userTypeDefs}
  ${projectTypeDefs}
  ${taskTypeDefs}
`;
