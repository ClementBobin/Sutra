# Sūtra — GraphQL API Walkthrough
> *सूत्र · The thread beneath the work.*

> **Audience:** External developers, internal teams, and non-technical stakeholders.
> **API Type:** GraphQL (single endpoint, flexible queries, full CRUD via Mutations)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Setup & Installation](#2-setup--installation)
3. [Authentication](#3-authentication)
4. [Queries — Reading Data](#4-queries--reading-data)
5. [Mutations — Create, Update, Delete](#5-mutations--create-update-delete)
6. [Error Handling & Best Practices](#6-error-handling--best-practices)

---

## 1. Overview

This API allows clients to manage **projects**, **tasks**, and **users** through a single GraphQL endpoint.

| Feature | Details |
|---|---|
| Endpoint | `https://api.sutra.dev/graphql` |
| Protocol | HTTP POST (GraphQL over HTTP) |
| Auth | Bearer Token (JWT) |
| Format | JSON |

### Why GraphQL?

Unlike REST, GraphQL lets you request **exactly the data you need** in a single call — no over-fetching, no multiple round trips.

```
# REST (3 calls needed)
GET /projects/1
GET /projects/1/tasks
GET /users/42

# GraphQL (1 call, you choose the shape)
query {
  project(id: "1") {
    name
    tasks { title status }
    owner { name email }
  }
}
```

---

## 2. Setup & Installation

### Prerequisites

- Node.js >= 18
- A package manager: `npm` or `yarn`
- A GraphQL client (examples use `fetch`, but [Apollo Client](https://www.apollographql.com/docs/react/) or [urql](https://formidable.com/open-source/urql/) are recommended for frontend apps)

### Install dependencies (server-side, Node.js example)

```bash
npm install graphql @apollo/server express
```

### Start the server

```bash
npm run dev
# GraphQL Playground available at http://localhost:4000/graphql
```

### Test the connection

```bash
curl -X POST https://api.sutra.dev/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

**Expected response:**
```json
{ "data": { "__typename": "Query" } }
```

---

## 3. Authentication

All API calls (except login/register) require a **JWT Bearer Token** in the `Authorization` header.

### 3.1 Register a new user

```graphql
mutation Register {
  register(input: {
    name: "Alice Martin"
    email: "alice@example.com"
    password: "securePassword123"
  }) {
    token
    user {
      id
      name
      email
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "register": {
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "user": {
        "id": "usr_01",
        "name": "Alice Martin",
        "email": "alice@example.com"
      }
    }
  }
}
```

### 3.2 Login

```graphql
mutation Login {
  login(email: "alice@example.com", password: "securePassword123") {
    token
    expiresAt
  }
}
```

### 3.3 Using the token

Include the token in every subsequent request:

```http
POST /graphql HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

> ⚠️ **Tokens expire after 24 hours.** Use the `refreshToken` mutation to get a new one without re-authenticating.

---

## 4. Queries — Reading Data

Queries are **read-only** operations (equivalent to `GET` in REST).

### 4.1 List all projects

```graphql
query GetProjects {
  projects {
    id
    name
    description
    createdAt
    owner {
      name
    }
  }
}
```

### 4.2 Get a single project with its tasks

```graphql
query GetProject {
  project(id: "proj_01") {
    id
    name
    tasks {
      id
      title
      status       # TODO | IN_PROGRESS | DONE
      priority     # LOW | MEDIUM | HIGH
      assignee {
        name
        email
      }
      dueDate
    }
  }
}
```

### 4.3 Filter tasks by status

```graphql
query GetInProgressTasks {
  tasks(filter: { status: IN_PROGRESS, projectId: "proj_01" }) {
    id
    title
    assignee { name }
  }
}
```

### 4.4 Get the current user's profile

```graphql
query Me {
  me {
    id
    name
    email
    assignedTasks {
      title
      status
      dueDate
    }
  }
}
```

---

## 5. Mutations — Create, Update, Delete

Mutations **modify data** (equivalent to `POST`, `PUT`, `PATCH`, `DELETE` in REST).

### 5.1 Create a project

```graphql
mutation CreateProject {
  createProject(input: {
    name: "Website Redesign"
    description: "Revamp the company website Q3"
  }) {
    id
    name
    createdAt
  }
}
```

### 5.2 Create a task

```graphql
mutation CreateTask {
  createTask(input: {
    projectId: "proj_01"
    title: "Design homepage mockup"
    priority: HIGH
    dueDate: "2026-06-15"
    assigneeId: "usr_01"
  }) {
    id
    title
    status
    assignee { name }
  }
}
```

### 5.3 Update a task

```graphql
mutation UpdateTask {
  updateTask(id: "task_42", input: {
    status: IN_PROGRESS
    priority: MEDIUM
    title: "Design homepage mockup (v2)"
  }) {
    id
    title
    status
    updatedAt
  }
}
```

### 5.4 Delete a task

```graphql
mutation DeleteTask {
  deleteTask(id: "task_42") {
    success
    message
  }
}
```

**Response:**
```json
{
  "data": {
    "deleteTask": {
      "success": true,
      "message": "Task task_42 deleted successfully."
    }
  }
}
```

### 5.5 Delete a project (and all its tasks)

```graphql
mutation DeleteProject {
  deleteProject(id: "proj_01") {
    success
    message
  }
}
```

> ⚠️ Deleting a project is **irreversible** and cascades to all associated tasks.

---

## 6. Error Handling & Best Practices

### 6.1 Error response format

GraphQL always returns HTTP `200`, even for errors. Check the `errors` array in the response.

```json
{
  "data": null,
  "errors": [
    {
      "message": "Not authorized",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["project"],
      "extensions": {
        "code": "UNAUTHORIZED",
        "http": { "status": 401 }
      }
    }
  ]
}
```

### 6.2 Common error codes

| Code | Meaning | Fix |
|---|---|---|
| `UNAUTHORIZED` | Missing or expired token | Re-authenticate and attach a valid Bearer token |
| `FORBIDDEN` | Valid token but insufficient permissions | Check user role and resource ownership |
| `NOT_FOUND` | Resource doesn't exist | Verify the `id` passed in the query/mutation |
| `BAD_USER_INPUT` | Invalid input (e.g. missing required field) | Check the input against the schema |
| `INTERNAL_SERVER_ERROR` | Unexpected server error | Retry with exponential backoff; contact support if persistent |

### 6.3 Best practices

**For developers:**
- Always query only the fields you need — avoid requesting entire objects unnecessarily.
- Use **named operations** (`query GetProject` instead of anonymous `query {}`) for easier debugging.
- Implement **pagination** for list queries using `first` / `after` cursor arguments.
- Cache tokens securely (e.g. `httpOnly` cookies) — never store them in `localStorage`.

**For the API:**
- Use **input validation** on every mutation argument server-side.
- Apply **rate limiting** per user/token to prevent abuse.
- Enable **query depth limiting** to prevent deeply nested malicious queries.
- Version your schema changes carefully — GraphQL is schema-first, deprecate fields before removing them.

### 6.4 Pagination example

```graphql
query GetTasksPaginated {
  tasks(first: 10, after: "cursor_xyz", filter: { projectId: "proj_01" }) {
    edges {
      node {
        id
        title
        status
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

---

## Appendix — Schema Summary

```graphql
type Project {
  id: ID!
  name: String!
  description: String
  owner: User!
  tasks: [Task!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Task {
  id: ID!
  title: String!
  status: TaskStatus!   # TODO | IN_PROGRESS | DONE
  priority: Priority!   # LOW | MEDIUM | HIGH
  assignee: User
  project: Project!
  dueDate: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

type User {
  id: ID!
  name: String!
  email: String!
  assignedTasks: [Task!]!
}
```

---

*Generated for prototype purposes. Adapt endpoint URLs, token strategies, and schema types to your production environment.*
