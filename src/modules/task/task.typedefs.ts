export const taskTypeDefs = `
  enum TaskStatus {
    TODO
    IN_PROGRESS
    DONE
  }

  enum Priority {
    LOW
    MEDIUM
    HIGH
  }

  type Task {
    id: ID!
    title: String!
    status: TaskStatus!
    priority: Priority!
    dueDate: String
    projectId: String!
    assigneeId: String
    project: Project!
    assignee: User
    createdAt: String!
    updatedAt: String!
  }

  input CreateTaskInput {
    projectId: String!
    title: String!
    priority: Priority
    dueDate: String
    assigneeId: String
  }

  input UpdateTaskInput {
    title: String
    status: TaskStatus
    priority: Priority
    dueDate: String
    assigneeId: String
  }

  input TaskFilter {
    projectId: String
    status: TaskStatus
    priority: Priority
    assigneeId: String
  }

  extend type Query {
    tasks(filter: TaskFilter, first: Int, after: String): [Task!]!
    task(id: ID!): Task!
  }

  extend type Mutation {
    createTask(input: CreateTaskInput!): Task!
    updateTask(id: ID!, input: UpdateTaskInput!): Task!
    deleteTask(id: ID!): DeletePayload!
  }
`;
