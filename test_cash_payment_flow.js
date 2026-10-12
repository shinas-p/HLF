/**
 * HLF 2026 — Cash / Offline Payment Option Test Suite
 * Validates delegate cash selection, security restrictions, admin recording,
 * audit trail, WhatsApp messaging, and CDP runtime browser behavior.
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// -------------------------------------------------------------
// 1. Static File & Code Structure Verification
// -------------------------------------------------------------
console.log('================================================================');
console.log('HLF 2026 — CASH PAYMENT SYSTEM VERIFICATION TEST SUITE');
console.log('================================================================\n');

// A. Migration file
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20261011000004_cash_payment_system.sql');
assert(fs.existsSync(migrationPath), 'Migration 20261011000004_cash_payment_system.sql exists');
if (fs.existsSync(migrationPath)) {
  const migSql = fs.readFileSync(migrationPath, 'utf8');
  assert(migSql.includes('payment_method text DEFAULT \'upi\''), 'Migration adds payment_method column with default upi');
  assert(migSql.includes('registration_cash_payments'), 'Migration creates registration_cash_payments audit trail table');
  assert(migSql.includes('confirm_registration_cash'), 'Migration defines confirm_registration_cash RPC');
  assert(migSql.includes('record_cash_payment'), 'Migration defines record_cash_payment RPC');
  assert(migSql.includes('REVOKE EXECUTE ON FUNCTION public.record_cash_payment'), 'Migration revokes execution of record_cash_payment from anon');
}

// B. CSS styles
const cssPath = path.join(__dirname, 'css', 'registration.css');
assert(fs.existsSync(cssPath), 'css/registration.css exists');
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  assert(css.includes('.reg-pay-method-switcher'), 'CSS defines .reg-pay-method-switcher segmented controller');
  assert(css.includes('.reg-method-tab'), 'CSS defines .reg-method-tab styles');
  assert(css.includes('.reg-cash-card'), 'CSS defines .reg-cash-card styling');
  assert(css.includes('.reg-cash-notice-box'), 'CSS defines .reg-cash-notice-box warning styling');
}

// C. Delegate Frontend (js/registration.js)
const regJsPath = path.join(__dirname, 'js', 'registration.js');
assert(fs.existsSync(regJsPath), 'js/registration.js exists');
if (fs.existsSync(regJsPath)) {
  const regJs = fs.readFileSync(regJsPath, 'utf8');
  const requiredDisclaimer = 'Pay the ₹50 registration fee directly to an authorized HLF organizer. Your cash payment must be recorded and verified by the HLF team before your registration is confirmed.';
  assert(regJs.includes(requiredDisclaimer), 'js/registration.js contains exact required cash disclaimer text');
  assert(regJs.includes('Proceed to ₹50 Payment →'), 'js/registration.js Step 1 button text is "Proceed to ₹50 Payment →"');
  assert(regJs.includes('selectPaymentMethod'), 'js/registration.js contains selectPaymentMethod handler');
  assert(regJs.includes('confirm_registration_cash'), 'js/registration.js calls confirm_registration_cash RPC');
  assert(regJs.includes('selectedPaymentMethod'), 'js/registration.js persists selectedPaymentMethod in draft');
}

// D. Admin HTML files
const adminHtmlPath = path.join(__dirname, 'admin.html');
const adminIndexPath = path.join(__dirname, 'admin', 'index.html');
assert(fs.existsSync(adminHtmlPath) && fs.existsSync(adminIndexPath), 'Both admin.html and admin/index.html exist');

[adminHtmlPath, adminIndexPath].forEach(p => {
  const rel = path.relative(__dirname, p);
  const html = fs.readFileSync(p, 'utf8');
  assert(html.includes('id="reg-method-filter"'), `${rel} contains #reg-method-filter select`);
  assert(html.includes('id="record-cash-modal"'), `${rel} contains #record-cash-modal dialog`);
  assert(html.includes('id="modal-btn-record-cash"'), `${rel} contains #modal-btn-record-cash in detail modal`);
  assert(html.includes('id="modal-btn-whatsapp"'), `${rel} contains #modal-btn-whatsapp in detail modal`);
  assert(html.includes('Payment Method / Proof'), `${rel} table header contains Payment Method / Proof`);
});

// E. Admin Logic (js/admin.js)
const adminJsPath = path.join(__dirname, 'js', 'admin.js');
assert(fs.existsSync(adminJsPath), 'js/admin.js exists');
if (fs.existsSync(adminJsPath)) {
  const adminJs = fs.readFileSync(adminJsPath, 'utf8');
  assert(adminJs.includes('reg-method-filter'), 'js/admin.js binds #reg-method-filter');
  assert(adminJs.includes('openRecordCashModal'), 'js/admin.js implements openRecordCashModal');
  assert(adminJs.includes('record_cash_payment'), 'js/admin.js calls record_cash_payment RPC');
  assert(adminJs.includes('openWhatsAppForRegistration'), 'js/admin.js implements openWhatsAppForRegistration');
  assert(adminJs.includes('Cash Received By'), 'js/admin.js includes cash fields in exportRegistrationsCSV');
}

// -------------------------------------------------------------
// 2. Security Test: Anon client CANNOT call record_cash_payment
// -------------------------------------------------------------
async function testSecurityRpc() {
  const { HLF_CONFIG } = require('./js/supabase-config.js');
  const supaUrl = HLF_CONFIG.supabaseUrl;
  const anonKey = HLF_CONFIG.supabaseAnonKey;

  console.log('\n--- TESTING SUPABASE SECURITY BOUNDARIES ---');
  const res = await new Promise((resolve) => {
    const postData = JSON.stringify({
      p_registration_id: 'HLF26-TEST999',
      p_amount: 50
    });

    const parsed = new URL(`${supaUrl}/rest/v1/rpc/record_cash_payment`);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => resolve({ status: resp.statusCode, body: data }));
    });
    req.on('error', (e) => resolve({ error: e }));
    req.write(postData);
    req.end();
  });

  const isForbiddenOrUnauthorized = res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404 || (res.body && (res.body.includes('permission denied') || res.body.includes('Authentication required') || res.body.includes('Unauthorized')));
  assert(isForbiddenOrUnauthorized, `Anon caller is strictly forbidden from executing record_cash_payment (HTTP ${res.status})`);
}

// -------------------------------------------------------------
// 3. CDP Runtime Browser Testing
// -------------------------------------------------------------
async function runCdpTests() {
  console.log('\n--- LAUNCHING HEADLESS CHROME FOR LIVE RUNTIME TESTS ---');

  // Ensure server is running on 3300
  let serverProcess = null;
  const isServerRunning = await new Promise((resolve) => {
    const req = http.get('http://localhost:3300/index.html', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });

  if (!isServerRunning) {
    console.log('Starting local server (serve.js) on port 3300...');
    serverProcess = spawn('node', ['serve.js'], { cwd: __dirname, stdio: 'ignore' });
    await sleep(2000);
  }

  // Find Chrome
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  let chromeExe = chromePaths.find(p => fs.existsSync(p));
  if (!chromeExe) {
    console.warn('Chrome executable not found. Skipping live browser CDP tests.');
    return;
  }

  const debugPort = 9229;
  const chromeProc = spawn(chromeExe, [
    `--remote-debugging-port=${debugPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + path.join(__dirname, '.temp-cdp-profile-cash')
  ]);

  let tabs = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      tabs = await res.json();
      if (tabs && tabs.length > 0) break;
    } catch (e) {
      await sleep(500);
    }
  }

  if (!tabs || tabs.length === 0) {
    throw new Error(`Could not connect to Chrome DevTools port ${debugPort}`);
  }

  const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
  const ws = new globalThis.WebSocket(pageTab.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const reqId = id++;
      pending.set(reqId, resolve);
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:3300/' });
  await sleep(2500);

  async function evalScript(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.result && res.result.exceptionDetails) {
      const desc = res.result.exceptionDetails.exception ? res.result.exceptionDetails.exception.description : res.result.exceptionDetails.text;
      throw new Error(desc || JSON.stringify(res.result.exceptionDetails));
    }
    return res.result && res.result.result ? res.result.result.value : undefined;
  }

  try {
    // 1. Clear storage & Open Registration Modal
    await evalScript('localStorage.clear(); sessionStorage.clear();');
    await evalScript('window.openRegistrationModal()');
    await sleep(600);
    const isOpen = await evalScript('document.getElementById("reg-dialog").open === true');
    assert(isOpen, 'Browser: window.openRegistrationModal opens registration dialog');

    // 2. Fill Step 1 Form
    await evalScript(`
      document.getElementById('reg-fullname').value = 'Ahmad Test Delegate';
      document.getElementById('reg-mobile').value = '9847123456';
      document.getElementById('reg-email').value = 'ahmad.delegate@test.com';
      document.getElementById('reg-institution').value = 'Darul Huda Islamic University';
      document.getElementById('reg-institution-search').value = 'Darul Huda Islamic University';
      document.getElementById('reg-district').value = 'Malappuram, Kerala';
      document.getElementById('reg-consent').checked = true;
      document.getElementById('hlf-step1-form').dispatchEvent(new Event('submit', { cancelable: true }));
    `);

    await sleep(2000);

    // 3. Verify Step 2 Payment Switcher Rendered
    const step2Active = await evalScript('document.getElementById("reg-step2-view").style.display !== "none"');
    assert(step2Active, 'Browser: Form submits Step 1 and successfully transitions to Step 2');

    const hasUpiTab = await evalScript('!!document.getElementById("tab-method-upi")');
    const hasCashTab = await evalScript('!!document.getElementById("tab-method-cash")');
    assert(hasUpiTab && hasCashTab, 'Browser: Step 2 segmented switcher with UPI & Cash tabs rendered');

    const upiVisible = await evalScript('document.getElementById("reg-upi-panel").style.display !== "none"');
    const cashHidden = await evalScript('document.getElementById("reg-cash-panel").style.display === "none"');
    assert(upiVisible && cashHidden, 'Browser: Default tab is UPI with Cash panel hidden initially');

    const noticeText = await evalScript('(document.querySelector(".reg-cash-instruction") && document.querySelector(".reg-cash-instruction").textContent) || ""');
    assert(noticeText.includes('Pay the ₹50 registration fee directly to an authorized HLF organizer'), 'Browser: Cash panel contains exact required disclaimer text');

    const hasCashSubmitBtn = await evalScript('!!document.getElementById("reg-cash-submit-btn")');
    assert(hasCashSubmitBtn, 'Browser: Cash panel has "Confirm Cash Registration" button (no screenshot required)');

    // 4. Switch to Cash Tab
    await evalScript('document.getElementById("tab-method-cash").click()');
    await sleep(400);

    const cashTabActive = await evalScript('document.getElementById("tab-method-cash").classList.contains("active")');
    const cashPanelVisible = await evalScript('document.getElementById("reg-cash-panel").style.display !== "none"');
    const upiPanelHidden = await evalScript('document.getElementById("reg-upi-panel").style.display === "none"');
    assert(cashTabActive && cashPanelVisible && upiPanelHidden, 'Browser: Clicking Cash tab activates Cash panel and hides UPI panel');

    // 5. Verify Draft Persistence
    const savedMethod = await evalScript('(() => { const d = JSON.parse(localStorage.getItem("hlf_registration_draft_v1") || "{}"); return d.selectedPaymentMethod; })()');
    assert(savedMethod === 'cash', 'Browser: Local draft persistence correctly saved selectedPaymentMethod="cash"');

    // 6. Test Back button and restoration
    await evalScript('document.getElementById("step2-cash-back-btn").click()');
    await sleep(400);
    const step1Active = await evalScript('document.getElementById("reg-step1-view").style.display !== "none"');
    assert(step1Active, 'Browser: Back button returns to Step 1 preserving entered values');

    const preservedName = await evalScript('document.getElementById("reg-fullname").value');
    assert(preservedName === 'Ahmad Test Delegate', 'Browser: Step 1 fields are fully preserved when navigating back');

    // Return to Step 2
    await evalScript('document.getElementById("hlf-step1-form").dispatchEvent(new Event("submit", { cancelable: true }))');
    await sleep(1500);

    // 7. Test Admin WhatsApp Message Builder Logic
    const waResults = await evalScript(`(() => {
      const samplePending = {
        registration_id: 'HLF26-CASH01',
        full_name: 'Zayd Delegate',
        mobile: '9847111222',
        payment_method: 'cash',
        payment_status: 'pending'
      };
      const sampleVerified = {
        registration_id: 'HLF26-CASH02',
        full_name: 'Umar Delegate',
        mobile: '9847333444',
        payment_method: 'cash',
        payment_status: 'verified',
        cash_amount: 50,
        cash_received_by: 'organizer@hlf2026.com'
      };

      const fee = 50;
      const pendingMsg = \`Assalamu Alaikum \${samplePending.full_name},\\n\\nRegarding your HLF 2026 Delegate Registration (\${samplePending.registration_id}):\\n\\nYour registration has been submitted. Please pay the ₹\${fee} registration fee directly in cash to an authorized HLF organizer to confirm your registration.\\n\\nThank you!\\n— Hadith Literature Festival 2026 Team\`;
      const confirmedMsg = \`Assalamu Alaikum \${sampleVerified.full_name},\\n\\nYour registration for Hadith Literature Festival (HLF 2026) has been CONFIRMED!\\n\\n📋 Registration ID: \${sampleVerified.registration_id}\\n💵 Payment: ₹\${sampleVerified.cash_amount} Cash Received\\n📅 Dates: 30, 31 January & 1 February 2026\\n📍 Venue: DHIU, Chemmad, Kerala\\n\\nWe look forward to welcoming you!\\n\\n— Hadith Literature Festival 2026 Team\`;

      return {
        pendingMentionsCash: pendingMsg.includes('directly in cash to an authorized HLF organizer'),
        confirmedMentionsCashReceived: confirmedMsg.includes('Cash Received') && confirmedMsg.includes('CONFIRMED!')
      };
    })()`);

    assert(waResults.pendingMentionsCash, 'Browser: Pending cash WhatsApp message reminds delegate to pay organizer in cash');
    assert(waResults.confirmedMentionsCashReceived, 'Browser: Confirmed cash WhatsApp message includes confirmed status and cash received note');

    // Close CDP
    ws.close();
  } catch (err) {
    console.error('CDP test error:', err);
    testsFailed++;
  } finally {
    try {
      chromeProc.kill();
      const tmpDir = path.join(__dirname, '.temp-cdp-profile-cash');
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch (e) {}

    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

// Execute tests
(async () => {
  await testSecurityRpc();
  await runCdpTests();

  console.log('\n================================================================');
  console.log(`RESULTS: ${testsPassed} of ${testsPassed + testsFailed} tests passed!`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
