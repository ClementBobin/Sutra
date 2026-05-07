import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

function renderWebviewPage(title: string, adminMode: boolean): string {
  const adminScript = adminMode
    ? `
      async function loadAdminData() {
        const result = await gql(
          \
          \`query AdminData { adminTokens { id appId name disabled revokedAt scopes owner { email } } webviewAccesses { userId level enabled user { email } } }\`,
          undefined,
          authToken
        );

        const tokenLines = (result.data?.adminTokens ?? []).map((token) =>
          \`<li><strong>\${token.appId}</strong> (\${token.owner.email}) - scopes: \${token.scopes.join(', ')} - disabled: \${token.disabled}</li>\`
        );
        document.getElementById('adminTokens').innerHTML = tokenLines.join('') || '<li>No tokens</li>';

        const accessLines = (result.data?.webviewAccesses ?? []).map((entry) =>
          \`<li>\${entry.user.email} - level: \${entry.level} - enabled: \${entry.enabled}</li>\`
        );
        document.getElementById('webviewAccess').innerHTML = accessLines.join('') || '<li>No access entries</li>';
      }
    `
    : '';

  const adminUi = adminMode
    ? `
      <section>
        <h2>Admin: all tokens</h2>
        <ul id="adminTokens"></ul>
      </section>
      <section>
        <h2>Admin: webview access</h2>
        <ul id="webviewAccess"></ul>
      </section>
    `
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      form { margin-bottom: 16px; }
      input, textarea, select, button { margin: 4px 0; padding: 8px; width: 100%; max-width: 480px; }
      .row { display: grid; grid-template-columns: repeat(2, minmax(200px, 1fr)); gap: 16px; max-width: 900px; }
      .hidden { display: none; }
      ul { padding-left: 20px; }
      code { background: #eee; padding: 2px 6px; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>

    <section id="loginSection">
      <h2>Authenticate</h2>
      <form id="loginForm">
        <input id="email" type="email" placeholder="Email" required />
        <input id="password" type="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
      <p id="loginMessage"></p>
    </section>

    <section id="dashboard" class="hidden">
      <h2>Your API tokens</h2>
      <ul id="tokenList"></ul>

      <div class="row">
        <form id="createTokenForm">
          <h3>Create token</h3>
          <input id="appId" placeholder="App ID" required />
          <input id="tokenName" placeholder="Name" required />
          <textarea id="tokenDescription" placeholder="Description"></textarea>
          <input id="expiration" type="datetime-local" />
          <label><input id="neverExpire" type="checkbox" /> Never expire (discouraged)</label>
          <input id="shareWith" placeholder="Share with user ids (comma separated)" />
          <input id="scopes" placeholder="Scopes e.g. API_READ,API_WRITE" required />
          <button type="submit">Create token</button>
        </form>

        <form id="tokenActionForm">
          <h3>Manage token</h3>
          <input id="manageTokenId" placeholder="Token ID" required />
          <input id="newName" placeholder="New name" />
          <input id="newScopes" placeholder="New scopes e.g. API_READ" />
          <input id="newExpiration" type="datetime-local" />
          <button type="button" id="updateTokenBtn">Update</button>
          <button type="button" id="extendTokenBtn">Extend</button>
          <button type="button" id="revokeTokenBtn">Revoke</button>
          <button type="button" id="toggleTokenBtn">Toggle disable/enable</button>
        </form>
      </div>

      <p id="tokenOutput"></p>
      ${adminUi}
    </section>

    <script>
      let authToken = null;

      async function gql(query, variables, token) {
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: 'Bearer ' + token } : {})
          },
          body: JSON.stringify({ query, variables })
        });

        const body = await response.json();
        if (body.errors && body.errors.length) {
          throw new Error(body.errors[0].message);
        }
        return body;
      }

      function parseScopes(raw) {
        return raw.split(',').map((value) => value.trim()).filter(Boolean);
      }

      async function loadTokens() {
        const result = await gql(
          `query MyTokens { myTokens { id appId name description scopes expiresAt disabled revokedAt sharedWith { userId accessLevel } } }`,
          undefined,
          authToken
        );

        const rows = result.data.myTokens.map((token) => {
          const shared = token.sharedWith.map((entry) => entry.userId + ':' + entry.accessLevel).join(', ');
          return `<li><code>${token.id}</code> <strong>${token.appId}</strong> - ${token.name} - scopes: ${token.scopes.join(', ')} - expires: ${token.expiresAt ?? 'never'} - disabled: ${token.disabled} - revoked: ${token.revokedAt ? 'yes' : 'no'} - shared: ${shared || 'none'}</li>`;
        });

        document.getElementById('tokenList').innerHTML = rows.join('') || '<li>No tokens yet</li>';
      }

      document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
          const loginResult = await gql(
            `mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token user { email role } } }`,
            { email, password }
          );

          authToken = loginResult.data.login.token;
          localStorage.setItem('sutraWebviewJwt', authToken);
          document.getElementById('loginMessage').innerText = 'Authenticated as ' + loginResult.data.login.user.email;
          document.getElementById('dashboard').classList.remove('hidden');
          await loadTokens();
          ${adminMode ? 'await loadAdminData();' : ''}
        } catch (error) {
          document.getElementById('loginMessage').innerText = error.message;
        }
      });

      document.getElementById('createTokenForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const neverExpire = document.getElementById('neverExpire').checked;
        const expirationRaw = document.getElementById('expiration').value;

        try {
          const result = await gql(
            `mutation CreateToken($input: CreateApiTokenInput!) { createApiToken(input: $input) { token tokenMeta { id appId name } } }`,
            {
              input: {
                appId: document.getElementById('appId').value,
                name: document.getElementById('tokenName').value,
                description: document.getElementById('tokenDescription').value || null,
                scopes: parseScopes(document.getElementById('scopes').value),
                expiresAt: neverExpire ? null : expirationRaw ? new Date(expirationRaw).toISOString() : null,
                sharedUserIds: document.getElementById('shareWith').value.split(',').map((v) => v.trim()).filter(Boolean)
              }
            },
            authToken
          );

          document.getElementById('tokenOutput').innerText = 'Created token (copy now): ' + result.data.createApiToken.token;
          await loadTokens();
          ${adminMode ? 'await loadAdminData();' : ''}
        } catch (error) {
          document.getElementById('tokenOutput').innerText = error.message;
        }
      });

      document.getElementById('updateTokenBtn').addEventListener('click', async () => {
        try {
          await gql(
            `mutation UpdateToken($id: ID!, $input: UpdateApiTokenInput!) { updateApiToken(id: $id, input: $input) { id } }`,
            {
              id: document.getElementById('manageTokenId').value,
              input: {
                name: document.getElementById('newName').value || undefined,
                scopes: parseScopes(document.getElementById('newScopes').value)
              }
            },
            authToken
          );
          await loadTokens();
        } catch (error) {
          document.getElementById('tokenOutput').innerText = error.message;
        }
      });

      document.getElementById('extendTokenBtn').addEventListener('click', async () => {
        try {
          const raw = document.getElementById('newExpiration').value;
          await gql(
            `mutation ExtendToken($id: ID!, $expiresAt: String) { extendApiToken(id: $id, expiresAt: $expiresAt) { id expiresAt } }`,
            { id: document.getElementById('manageTokenId').value, expiresAt: raw ? new Date(raw).toISOString() : null },
            authToken
          );
          await loadTokens();
        } catch (error) {
          document.getElementById('tokenOutput').innerText = error.message;
        }
      });

      document.getElementById('revokeTokenBtn').addEventListener('click', async () => {
        try {
          await gql(
            `mutation RevokeToken($id: ID!) { revokeApiToken(id: $id) { success message } }`,
            { id: document.getElementById('manageTokenId').value },
            authToken
          );
          await loadTokens();
          ${adminMode ? 'await loadAdminData();' : ''}
        } catch (error) {
          document.getElementById('tokenOutput').innerText = error.message;
        }
      });

      document.getElementById('toggleTokenBtn').addEventListener('click', async () => {
        try {
          await gql(
            `mutation ToggleToken($id: ID!) { toggleApiTokenEnabled(id: $id) { id disabled } }`,
            { id: document.getElementById('manageTokenId').value },
            authToken
          );
          await loadTokens();
          ${adminMode ? 'await loadAdminData();' : ''}
        } catch (error) {
          document.getElementById('tokenOutput').innerText = error.message;
        }
      });

      const existing = localStorage.getItem('sutraWebviewJwt');
      if (existing) {
        authToken = existing;
        document.getElementById('dashboard').classList.remove('hidden');
        loadTokens().catch(() => undefined);
        ${adminMode ? 'loadAdminData().catch(() => undefined);' : ''}
      }
    </script>
  </body>
</html>`;
}

export async function registerWebviewRoutes(app: FastifyInstance): Promise<void> {
  app.get('/webview', async (_request: FastifyRequest, reply: FastifyReply) => {
    await reply.type('text/html').send(renderWebviewPage('Sūtra Token Webview', false));
  });

  app.get('/webview/admin', async (_request: FastifyRequest, reply: FastifyReply) => {
    await reply.type('text/html').send(renderWebviewPage('Sūtra Admin Token Webview', true));
  });
}
