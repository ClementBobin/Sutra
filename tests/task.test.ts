import { describe, expect, it } from 'vitest';
import { app } from './setup.ts';

async function graphqlRequest(query: string, variables?: Record<string, unknown>, token?: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    payload: { query, variables }
  });

  return response.json();
}

async function registerAndGetToken(name: string, email: string): Promise<string> {
  const result = await graphqlRequest(
    `mutation Register($input: RegisterInput!) { register(input: $input) { token } }`,
    { input: { name, email, password: 'password123' } }
  );

  return result.data.register.token as string;
}

describe('task module', () => {
  it('supports task CRUD for project owner', async () => {
    const token = await registerAndGetToken('Alice', 'alice@example.com');

    const project = await graphqlRequest(
      `mutation Create($input: CreateProjectInput!) { createProject(input: $input) { id } }`,
      { input: { name: 'Task Project' } },
      token
    );

    const projectId = project.data.createProject.id as string;

    const created = await graphqlRequest(
      `mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id title status } }`,
      { input: { projectId, title: 'Task 1', priority: 'HIGH' } },
      token
    );

    const taskId = created.data.createTask.id as string;
    expect(created.data.createTask.status).toBe('TODO');

    const updated = await graphqlRequest(
      `mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { status } }`,
      { id: taskId, input: { status: 'DONE' } },
      token
    );

    expect(updated.data.updateTask.status).toBe('DONE');

    const deleted = await graphqlRequest(`mutation DeleteTask($id: ID!) { deleteTask(id: $id) { success } }`, { id: taskId }, token);

    expect(deleted.data.deleteTask.success).toBe(true);
  });

  it('filters by status and priority', async () => {
    const token = await registerAndGetToken('Alice', 'alice@example.com');

    const project = await graphqlRequest(
      `mutation Create($input: CreateProjectInput!) { createProject(input: $input) { id } }`,
      { input: { name: 'Filter Project' } },
      token
    );

    const projectId = project.data.createProject.id as string;

    await graphqlRequest(
      `mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id } }`,
      { input: { projectId, title: 'Task A', priority: 'HIGH' } },
      token
    );
    const taskB = await graphqlRequest(
      `mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id } }`,
      { input: { projectId, title: 'Task B', priority: 'LOW' } },
      token
    );

    await graphqlRequest(
      `mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { id } }`,
      { id: taskB.data.createTask.id as string, input: { status: 'IN_PROGRESS' } },
      token
    );

    const statusFiltered = await graphqlRequest(
      `query Filter($filter: TaskFilter) { tasks(filter: $filter) { id status } }`,
      { filter: { status: 'IN_PROGRESS' } },
      token
    );

    expect(statusFiltered.data.tasks).toHaveLength(1);

    const priorityFiltered = await graphqlRequest(
      `query Filter($filter: TaskFilter) { tasks(filter: $filter) { id priority } }`,
      { filter: { priority: 'HIGH' } },
      token
    );

    expect(priorityFiltered.data.tasks).toHaveLength(1);
  });

  it('supports cursor pagination on tasks query', async () => {
    const token = await registerAndGetToken('Alice', 'alice@example.com');

    const project = await graphqlRequest(
      `mutation Create($input: CreateProjectInput!) { createProject(input: $input) { id } }`,
      { input: { name: 'Pagination Project' } },
      token
    );

    const projectId = project.data.createProject.id as string;

    const task1 = await graphqlRequest(
      `mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id } }`,
      { input: { projectId, title: 'Task 1' } },
      token
    );

    await graphqlRequest(
      `mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id } }`,
      { input: { projectId, title: 'Task 2' } },
      token
    );

    await graphqlRequest(
      `mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id } }`,
      { input: { projectId, title: 'Task 3' } },
      token
    );

    const firstPage = await graphqlRequest(
      `query Paginated($first: Int, $filter: TaskFilter) { tasks(first: $first, filter: $filter) { id title } }`,
      { first: 2, filter: { projectId } },
      token
    );

    expect(firstPage.data.tasks).toHaveLength(2);

    const cursor = Buffer.from(task1.data.createTask.id as string, 'utf8').toString('base64');
    const secondPage = await graphqlRequest(
      `query Paginated($first: Int, $after: String, $filter: TaskFilter) { tasks(first: $first, after: $after, filter: $filter) { id title } }`,
      { first: 2, after: cursor, filter: { projectId } },
      token
    );

    expect(secondPage.data.tasks.length).toBeGreaterThanOrEqual(1);
  });
});
