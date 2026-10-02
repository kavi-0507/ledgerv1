import assert from 'node:assert/strict';
import test from 'node:test';
import { auth, loadWorkspace, saveWorkspace, setWorkspaceClientForTests, validateWorkspace } from '../lib/cloud-workspace.ts';
import { blankState } from '../lib/ledger.ts';

const calls = [];
let row = null;
let conflict = false;
const fake = {
  auth: {
    getSession: async () => ({ data: { session: { access_token: 'test' } }, error: null }),
    getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    signInWithOtp: async input => { calls.push({ type: 'otp', input }); return { error: null }; },
    signOut: async () => { calls.push({ type: 'signout' }); return { error: null }; },
    onAuthStateChange: listener => {
      calls.push({ type: 'subscribe', listener });
      return { data: { subscription: { unsubscribe: () => calls.push({ type: 'unsubscribe' }) } } };
    },
  },
  from: table => ({
    select: columns => ({
      eq: (column, value) => ({
        maybeSingle: async () => {
          calls.push({ type: 'select', table, columns, column, value });
          return { data: row, error: null };
        },
      }),
    }),
  }),
  rpc: async (name, input) => {
    calls.push({ type: 'rpc', name, input });
    if (conflict) return { data: null, error: { message: 'revision_conflict' } };
    row = { state: input.next_state, revision: input.expected_revision + 1 };
    return { data: row.revision, error: null };
  },
};
setWorkspaceClientForTests(fake);

test('loads only the signed-in user’s workspace', async () => {
  const first = await loadWorkspace();
  assert.equal(first.revision, 0);
  assert.deepEqual(first.state, blankState());
  assert.deepEqual(calls.find(call => call.type === 'select'), {
    type: 'select', table: 'ledger_workspaces', columns: 'state,revision', column: 'user_id', value: 'user-1',
  });
});

test('saves with an atomic expected revision and preserves conflict errors', async () => {
  assert.equal(await saveWorkspace(blankState(), 0), 1);
  assert.equal(calls.find(call => call.type === 'rpc').name, 'save_ledger_workspace');
  assert.equal(calls.find(call => call.type === 'rpc').input.expected_revision, 0);
  assert.equal((await loadWorkspace()).revision, 1);
  conflict = true;
  await assert.rejects(saveWorkspace(blankState(), 0), /changed in another tab/);
  conflict = false;
});

test('rejects broken category references before a database request', () => {
  const invalid = blankState();
  invalid.budgets = [{ category: 'missing-category', limit: 50 }];
  assert.throws(() => validateWorkspace(invalid), /category is missing/);
});

test('passes the Pages return URL to Supabase Auth', async () => {
  await auth.signInWithOtp('person@example.com', 'https://kavi-0507.github.io/ledgerv1/?mode=own');
  assert.deepEqual(calls.find(call => call.type === 'otp').input, {
    email: 'person@example.com',
    options: { emailRedirectTo: 'https://kavi-0507.github.io/ledgerv1/?mode=own' },
  });
  await auth.signOut();
  assert.ok(calls.some(call => call.type === 'signout'));
});
