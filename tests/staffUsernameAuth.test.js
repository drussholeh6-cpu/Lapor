const assert = require('node:assert/strict');
const test = require('node:test');

test('username account can be deleted and registered again', async () => {
  const configPath = require.resolve('../config/supabase');
  const servicePath = require.resolve('../services/authService');
  const users = [];
  const profiles = [];
  let signedInEmail;

  function query(table) {
    const filters = {};
    return {
      select() {
        return this;
      },
      eq(column, value) {
        filters[column] = value;
        return this;
      },
      async maybeSingle() {
        const rows = table === 'staff_profiles' ? profiles : [];
        return {
          data: rows.find((row) => Object.entries(filters).every(([key, value]) => row[key] === value)) || null,
          error: null,
        };
      },
      async upsert(row) {
        const index = profiles.findIndex((profile) => profile.email === row.email);
        if (index === -1) profiles.push(row);
        else profiles[index] = row;
        return { error: null };
      },
      delete() {
        this.operation = 'delete';
        return this;
      },
      then(resolve) {
        if (this.operation === 'delete') {
          const index = profiles.findIndex((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
          if (index !== -1) profiles.splice(index, 1);
        }
        resolve({ error: null });
      },
    };
  }

  const admin = {
    from: query,
    auth: {
      admin: {
        async listUsers() {
          return { data: { users: [...users] }, error: null };
        },
        async createUser(options) {
          if (users.some((user) => user.email === options.email)) {
            return { data: null, error: new Error('User already registered') };
          }
          const user = {
            id: `staff-${users.length + 1}`,
            email: options.email,
            user_metadata: options.user_metadata,
            app_metadata: options.app_metadata,
          };
          user.password = options.password;
          users.push(user);
          return { data: { user }, error: null };
        },
        async updateUserById(id, updates) {
          const user = users.find((item) => item.id === id);
          if (!user) return { error: new Error('User not found') };
          Object.assign(user, updates);
          return { error: null };
        },
        async deleteUser(id) {
          const index = users.findIndex((user) => user.id === id);
          if (index !== -1) users.splice(index, 1);
          return { error: null };
        },
      },
    },
  };
  const auth = {
    auth: {
      async signInWithPassword({ email }) {
        signedInEmail = email;
        const user = users.find((item) => item.email === email);
        return user
          ? { data: { session: { access_token: 'test-token' }, user }, error: null }
          : { data: null, error: new Error('Invalid credentials') };
      },
      async getUser() {
        return { data: { user: users.find((user) => user.email === signedInEmail) }, error: null };
      },
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: { supabaseAdmin: () => admin, supabaseAuth: () => auth },
  };
  delete require.cache[servicePath];
  const authService = require('../services/authService');

  const actor = { role: 'admin', uid: 'admin-1', email: 'admin@example.test' };
  const input = {
    identifier: 'Petugas_01',
    name: 'Petugas Contoh',
    unit: 'Tim Drainase',
    password: 'rahasia1',
  };

  const firstAccount = await authService.registerStaffAccount(input, actor);
  assert.equal(firstAccount.username, 'petugas_01');
  assert.equal(profiles.length, 1);

  profiles.splice(0, profiles.length);
  const recoveredAccount = await authService.registerStaffAccount(input, actor);
  assert.equal(recoveredAccount.email, firstAccount.email);
  assert.equal(users.length, 1);
  assert.equal(profiles.length, 1);

  await authService.deleteStaffAccount({ email: recoveredAccount.email }, actor);
  assert.equal(users.length, 0);
  assert.equal(profiles.length, 0);

  const secondAccount = await authService.registerStaffAccount(input, actor);
  assert.notEqual(secondAccount.email, firstAccount.email);
  assert.equal(users.length, 1);
  assert.equal(profiles.length, 1);

  const session = await authService.login('PETUGAS_01', input.password);
  assert.equal(signedInEmail, secondAccount.email);
  assert.equal(session.user.username, 'petugas_01');

  delete require.cache[servicePath];
  delete require.cache[configPath];
});
