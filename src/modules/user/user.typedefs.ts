export const userTypeDefs = `
  type User {
    id: ID!
    name: String!
    email: String!
    createdAt: String!
    updatedAt: String!
    ownedProjects: [Project!]!
    assignedTasks: [Task!]!
  }

  type AuthPayload {
    token: String!
    expiresAt: String!
    user: User!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
  }

  extend type Query {
    me: User!
  }

  extend type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    refreshToken: AuthPayload!
  }
`;
