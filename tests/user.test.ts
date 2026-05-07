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

describe('user module', () => {
  it('registers a user', async () => {
    const result = await graphqlRequest(
      `mutation Register($input: RegisterInput!) { register(input: $input) { token user { id email name } } }`,
      {
        input: {
          name: 'Alice',
          email: 'alice@example.com',
          password: 'password123'
        }
      }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.register.user.email).toBe('alice@example.com');
    expect(result.data.register.token).toBeTypeOf('string');
  });

  it('returns duplicate email error', async () => {
    await graphqlRequest(
      `mutation Register($input: RegisterInput!) { register(input: $input) { user { id } } }`,
      { input: { name: 'Alice', email: 'alice@example.com', password: 'password123' } }
    );

    const duplicate = await graphqlRequest(
      `mutation Register($input: RegisterInput!) { register(input: $input) { user { id } } }`,
      { input: { name: 'Alice 2', email: 'alice@example.com', password: 'password123' } }
    );

    expect(duplicate.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('logs in and reads me', async () => {
    await graphqlRequest(
      `mutation Register($input: RegisterInput!) { register(input: $input) { user { id } } }`,
      { input: { name: 'Alice', email: 'alice@example.com', password: 'password123' } }
    );

    const login = await graphqlRequest(
      `mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token } }`,
      { email: 'alice@example.com', password: 'password123' }
    );

    const token = login.data.login.token as string;
    const me = await graphqlRequest(`query Me { me { id email name } }`, undefined, token);

    expect(me.errors).toBeUndefined();
    expect(me.data.me.email).toBe('alice@example.com');
  });
});
