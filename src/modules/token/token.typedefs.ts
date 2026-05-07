export const tokenTypeDefs = `
  enum UserRole {
    USER
    ADMIN
  }

  enum TokenScope {
    API_READ
    API_WRITE
    API_ADMIN
  }

  enum ShareAccessLevel {
    VIEWER
    EDITOR
    MANAGER
  }

  enum WebviewAccessLevel {
    VIEWER
    EDITOR
    ADMIN
  }

  type ApiToken {
    id: ID!
    appId: String!
    name: String!
    description: String
    tokenPrefix: String!
    scopes: [TokenScope!]!
    expiresAt: String
    revokedAt: String
    disabled: Boolean!
    ownerId: String!
    owner: User!
    sharedWith: [TokenShare!]!
    isExpired: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type TokenShare {
    id: ID!
    tokenId: String!
    userId: String!
    accessLevel: ShareAccessLevel!
    disabled: Boolean!
    user: User!
    createdAt: String!
    updatedAt: String!
  }

  type ApiTokenCreationPayload {
    token: String!
    tokenMeta: ApiToken!
  }

  type WebviewAccess {
    id: ID!
    userId: String!
    level: WebviewAccessLevel!
    enabled: Boolean!
    grantedById: String
    user: User!
    createdAt: String!
    updatedAt: String!
  }

  input CreateApiTokenInput {
    appId: String!
    name: String!
    description: String
    scopes: [TokenScope!]!
    expiresAt: String
    sharedUserIds: [String!]!
  }

  input UpdateApiTokenInput {
    name: String
    description: String
    scopes: [TokenScope!]
  }

  input ShareTokenInput {
    tokenId: String!
    userId: String!
    accessLevel: ShareAccessLevel!
  }

  input GrantWebviewAccessInput {
    userId: String!
    level: WebviewAccessLevel!
    enabled: Boolean
  }

  input AdminTokenFilter {
    ownerId: String
    includeRevoked: Boolean
    includeDisabled: Boolean
  }

  extend type User {
    role: UserRole!
  }

  extend type Query {
    myTokens(includeRevoked: Boolean): [ApiToken!]!
    token(id: ID!): ApiToken!
    adminTokens(filter: AdminTokenFilter): [ApiToken!]!
    webviewAccesses: [WebviewAccess!]!
  }

  extend type Mutation {
    createApiToken(input: CreateApiTokenInput!): ApiTokenCreationPayload!
    updateApiToken(id: ID!, input: UpdateApiTokenInput!): ApiToken!
    extendApiToken(id: ID!, expiresAt: String): ApiToken!
    revokeApiToken(id: ID!): DeletePayload!
    toggleApiTokenEnabled(id: ID!): ApiToken!

    shareToken(input: ShareTokenInput!): TokenShare!
    removeTokenShare(tokenId: String!, userId: String!): DeletePayload!
    setTokenShareEnabled(tokenId: String!, userId: String!, enabled: Boolean!): TokenShare!

    adminRevokeToken(id: ID!): DeletePayload!
    adminSetTokenEnabled(id: ID!, enabled: Boolean!): ApiToken!

    grantWebviewAccess(input: GrantWebviewAccessInput!): WebviewAccess!
    setWebviewAccessEnabled(userId: String!, enabled: Boolean!): WebviewAccess!
    removeWebviewAccess(userId: String!): DeletePayload!
  }
`;
