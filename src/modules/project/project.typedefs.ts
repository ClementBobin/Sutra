export const projectTypeDefs = `
  type Project {
    id: ID!
    name: String!
    description: String
    ownerId: String!
    owner: User!
    tasks: [Task!]!
    createdAt: String!
    updatedAt: String!
  }

  input CreateProjectInput {
    name: String!
    description: String
  }

  input UpdateProjectInput {
    name: String
    description: String
  }

  input ProjectFilter {
    ownerId: String
  }

  type DeletePayload {
    success: Boolean!
    message: String!
  }

  extend type Query {
    projects(filter: ProjectFilter, first: Int, after: String): [Project!]!
    project(id: ID!): Project!
  }

  extend type Mutation {
    createProject(input: CreateProjectInput!): Project!
    updateProject(id: ID!, input: UpdateProjectInput!): Project!
    deleteProject(id: ID!): DeletePayload!
  }
`;
