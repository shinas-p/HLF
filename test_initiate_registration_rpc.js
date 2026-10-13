/**
 * HLF 2026 — Verification Test for initiate_registration RPC Ambiguity Fix
 * Validates canonical RPC execution, parameter parsing, input validation, and PostgREST schema resolution.
 */

const https = require('https');
const { HLF_CONFIG } = require('./js/supabase-config.js');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`✗ FAIL: ${testName}`);
    testsFailed++;
  }
}

function callRpc(rpcName, params) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(params);
    const parsed = new URL(`${HLF_CONFIG.supabaseUrl}/rest/v1/rpc/${rpcName}`);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': HLF_CONFIG.supabaseAnonKey,
        'Authorization': `Bearer ${HLF_CONFIG.supabaseAnonKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', err => resolve({ error: err }));
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('HLF 2026 — INITIATE_REGISTRATION RPC AMBIGUITY VERIFICATION');
  console.log('================================================================\n');

  // Test 1: Valid sample data with all 10 canonical parameters
  console.log('--- 1. VALID CANONICAL PARAMETER RPC EXECUTION ---');
  const sampleMobile = '9847' + Math.floor(100000 + Math.random() * 900000);
  const validRes = await callRpc('initiate_registration', {
    p_full_name: 'Muhammed Nihal Test',
    p_mobile: sampleMobile,
    p_institution: 'Darul Huda Islamic University',
    p_email: 'nihal.test@dhiu.in',
    p_course: 'Degree 2nd Year',
    p_department: 'Hadith Studies',
    p_district: 'Malappuram',
    p_accommodation_required: false,
    p_food_required: false,
    p_special_requirements: 'Needs wheelchair access'
  });

  assert(validRes.status === 200, `RPC responds with HTTP 200 (got ${validRes.status})`);
  assert(validRes.body && validRes.body.success === true, 'Response body contains success: true');
  assert(validRes.body && typeof validRes.body.registration_id === 'string' && validRes.body.registration_id.startsWith('HLF26-'), `Allocates valid Registration ID: ${validRes.body ? validRes.body.registration_id : 'none'}`);
  assert(validRes.body && validRes.body.payment_status === 'pending', 'Payment status is initially pending (no premature verification)');
  assert(validRes.body && validRes.body.registration_status === 'submitted', 'Registration status is submitted');
  assert(validRes.body && Number(validRes.body.registration_fee) === 50, 'Registration fee is correctly set to ₹50');

  // Test 2: Call with minimal required parameters (tests optional defaults and absence of ambiguity)
  console.log('\n--- 2. MINIMAL PARAMETER RPC RESOLUTION (NO AMBIGUITY) ---');
  const minimalMobile = '9847' + Math.floor(100000 + Math.random() * 900000);
  const minRes = await callRpc('initiate_registration', {
    p_full_name: 'Ahmad Minimal Test',
    p_mobile: minimalMobile,
    p_institution: 'Markaz Garden Academy'
  });

  assert(minRes.status === 200, `Minimal parameters call succeeds without ambiguity (HTTP ${minRes.status})`);
  assert(minRes.body && minRes.body.success === true, 'Minimal parameter call returns success: true');
  assert(minRes.body && typeof minRes.body.registration_id === 'string', `Allocates Registration ID: ${minRes.body ? minRes.body.registration_id : 'none'}`);

  // Test 3: Input Validation — Missing Full Name
  console.log('\n--- 3. INPUT VALIDATION TESTS ---');
  const noNameRes = await callRpc('initiate_registration', {
    p_full_name: '',
    p_mobile: '9847112233',
    p_institution: 'Darul Huda'
  });
  const noNameRejected = noNameRes.status >= 400 && noNameRes.raw.includes('Full name is required');
  assert(noNameRejected, `Rejects empty full name with validation message (HTTP ${noNameRes.status})`);

  // Test 4: Input Validation — Invalid Mobile Number (< 10 digits)
  const badMobileRes = await callRpc('initiate_registration', {
    p_full_name: 'Muhammed Test',
    p_mobile: '9847',
    p_institution: 'Darul Huda'
  });
  const badMobileRejected = badMobileRes.status >= 400 && badMobileRes.raw.includes('Valid mobile number is required');
  assert(badMobileRejected, `Rejects invalid mobile number with validation message (HTTP ${badMobileRes.status})`);

  // Test 5: Input Validation — Missing Institution
  const noInstRes = await callRpc('initiate_registration', {
    p_full_name: 'Muhammed Test',
    p_mobile: '9847112233',
    p_institution: ''
  });
  const noInstRejected = noInstRes.status >= 400 && noInstRes.raw.includes('College / Institution is required');
  assert(noInstRejected, `Rejects empty institution with validation message (HTTP ${noInstRes.status})`);

  // Test 6: Verify Deprecated Overload is strictly non-callable
  console.log('\n--- 4. DEPRECATED OVERLOAD PROTECTION TEST ---');
  const depRes = await callRpc('initiate_registration_deprecated', {
    p_full_name: 'Hacker Attempt',
    p_mobile: '9847112233',
    p_institution: 'Test Inst'
  });
  const depForbidden = depRes.status === 401 || depRes.status === 403 || depRes.status === 404 || depRes.raw.includes('permission denied');
  assert(depForbidden, `Deprecated signature initiate_registration_deprecated is inaccessible (HTTP ${depRes.status})`);

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('================================================================\n');

  process.exit(testsFailed > 0 ? 1 : 0);
}

run();
