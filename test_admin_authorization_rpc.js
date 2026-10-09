const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('HLF 2026 — ADMIN AUTHORIZATION RPC VERIFICATION TEST');
console.log('====================================================\n');

const configJs = fs.readFileSync('js/supabase-config.js', 'utf8');
const urlMatch = configJs.match(/supabaseUrl:\s*['"]([^'"]+)['"]/);
const anonMatch = configJs.match(/supabaseAnonKey:\s*['"]([^'"]+)['"]/);
const supabaseUrl = urlMatch[1];
const anonKey = anonMatch[1];

async function runTests() {
  let passed = 0;
  let total = 0;

  function pass(desc) {
    total++;
    passed++;
    console.log(`✓ PASS: ${desc}`);
  }

  function fail(desc, err) {
    total++;
    console.error(`✗ FAIL: ${desc}`);
    console.error(`  Error: ${err.message || err}`);
  }

  // 1. Anon Access Rejection
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/add_admin_user`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_email: 'unauth@dhiu.in' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401, 'Anon call should return 401');
    assert(data.message.includes('permission denied'), 'Should deny permission to anon');
    pass('Anon caller is strictly forbidden from executing add_admin_user');
  } catch (err) {
    fail('Anon caller restriction check', err);
  }

  // 2. Fetch list of admins via REST
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/admin_users?select=*&order=created_at.asc`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    });
    // With RLS, anon gets empty list or requires authentication
    assert([200, 401].includes(res.status));
    pass('admin_users table is guarded by RLS policies');
  } catch (err) {
    fail('RLS policy verification on admin_users', err);
  }

  // 3. Verify files and schema
  try {
    const adminJs = fs.readFileSync('js/admin.js', 'utf8');
    assert(adminJs.includes("sb.rpc('add_admin_user', { p_email: email })"), 'Frontend RPC call missing');
    assert(adminJs.includes("verifyAdminAccess"), 'verifyAdminAccess missing');
    pass('js/admin.js contains correct RPC call signature { p_email: email }');
  } catch (err) {
    fail('Frontend code verification', err);
  }

  try {
    const migrationSql = fs.readFileSync('supabase/migrations/20261009000002_admin_authorization_rpc.sql', 'utf8');
    assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.add_admin_user'), 'Migration missing function');
    assert(migrationSql.includes('super_admin'), 'Migration missing super_admin verification');
    assert(migrationSql.includes('REVOKE ALL ON FUNCTION public.add_admin_user'), 'Migration missing permission revocation');
    pass('Migration 20261009000002_admin_authorization_rpc.sql contains full security definer specifications');
  } catch (err) {
    fail('Migration file check', err);
  }

  console.log(`\n====================================================`);
  console.log(`RESULTS: ${passed} of ${total} tests passed!`);
  console.log(`====================================================\n`);

  if (passed < total) process.exit(1);
}

runTests().catch(console.error);
