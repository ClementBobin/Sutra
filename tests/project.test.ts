import { describe, expect, it } from 'vitest';
import { app } from '/home/runner/work/Sutra/Sutra/tests/setup.ts';

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

describe('project module', () => {
  it('supports project CRUD for owner', async () => {
    const token = await registerAndGetToken('Alice', 'alice@example.com');

    const created = await graphqlRequest(
      `mutation Create($input: CreateProjectInput!) { createProject(input: $input) { id name description } }`,
      { input: { name: 'Project A', description: 'Desc' } },
      token
    );

    const projectId = created.data.createProject.id as string;
    expect(created.errors).toBeUndefined();

    const listed = await graphqlRequest(`query { projects { id name } }`, undefined, token);
    expect(listed.data.projects).toHaveLength(1);

    const updated = await graphqlRequest(
      `mutation Update($id: ID!, $input: UpdateProjectInput!) { updateProject(id: $id, input: $input) { name } }`,
      { id: projectId, input: { name: 'Project A+' } },
      token
    );
    expect(updated.data.updateProject.name).toBe('Project A+');

    const deleted = await graphqlRequest(`mutation Delete($id: ID!) { deleteProject(id: $id) { success } }`, { id: projectId }, token);
    expect(deleted.data.deleteProject.success).toBe(true);
  });

  it('enforces project ownership on update/delete', async () => {
    const ownerToken = await registerAndGetToken('Owner', 'owner@example.com');
    const otherToken = await registerAndGetToken('Other', 'other@example.com');

    const created = await graphqlRequest(
      `mutation Create($input: CreateProjectInput!) { createProject(input: $input) { id } }`,
      { input: { name: 'Protected Project' } },
      ownerToken
    );

    const projectId = created.data.createProject.id as string;

    const deniedUpdate = await graphqlRequest(
      `mutation Update($id: ID!, $input: UpdateProjectInput!) { updateProject(id: $id, input: $input) { id } }`,
      { id: projectId, input: { name: 'Hack' } },
      otherToken
    );

    expect(deniedUpdate.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

    const deniedDelete = await graphqlRequest(
      `mutation Delete($id: ID!) { deleteProject(id: $id) { success } }`,
      { id: projectId },
      otherToken
    );

    expect(deniedDelete.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('deletes related tasks when deleting project', async () => {
    const token = await registerAndGetToken('Alice', 'alice@example.com');

    const project = await graphqlRequest(
      `mutation Create($input: CreateProjectInput!) { createProject(input: $input) { id } }`,
      { input: { name: 'Cascade Project' } },
      token
    );

    const projectId = project.data.createProject.id as string;

    await graphqlRequest(
      `mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id } }`,
      { input: { projectId, title: 'Task in project' } },
      token
    );

    await graphqlRequest(`mutation Delete($id: ID!) { deleteProject(id: $id) { success } }`, { id: projectId }, token);

    const tasks = await graphqlRequest(`query { tasks { id } }`, undefined, token);
    expect(tasks.data.tasks).toHaveLength(0);
  });
});
