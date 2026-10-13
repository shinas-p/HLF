/**
 * HLF 2026 — Quiz Competition Registration Test Suite
 * Validates modal integration in index.html, matching Delegate Registration design,
 * Supabase schema & RPCs, security boundaries, duplicate prevention,
 * admin panel integration, and CDP runtime browser behavior.
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

console.log('================================================================');
console.log('HLF 2026 — QUIZ COMPETITION MODAL INTEGRATION TEST SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. Static File & Code Structure Verification
// -------------------------------------------------------------
console.log('--- 1. STATIC CODE & STRUCTURE VERIFICATION ---');

// A. Migration file
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20261013000001_quiz_competition_system.sql');
assert(fs.existsSync(migrationPath), 'Migration 20261013000001_quiz_competition_system.sql exists');
if (fs.existsSync(migrationPath)) {
  const migSql = fs.readFileSync(migrationPath, 'utf8');
  assert(migSql.includes('hlf_quiz_reg_seq'), 'Migration creates sequence hlf_quiz_reg_seq');
  assert(migSql.includes('quiz_registrations'), 'Migration creates quiz_registrations table');
  assert(migSql.includes('quiz_ref'), 'Migration includes quiz_ref column');
  assert(migSql.includes('submit_quiz_registration'), 'Migration creates submit_quiz_registration RPC');
  assert(migSql.includes('update_quiz_registration_status'), 'Migration creates update_quiz_registration_status RPC');
  assert(migSql.includes('REVOKE EXECUTE ON FUNCTION public.update_quiz_registration_status(uuid, text) FROM anon'), 'Migration revokes execution of update_quiz_registration_status from anon');
}

// B. Clean Redirect Page (quiz.html)
const quizHtmlPath = path.join(__dirname, 'quiz.html');
assert(fs.existsSync(quizHtmlPath), 'quiz.html exists');
if (fs.existsSync(quizHtmlPath)) {
  const quizHtml = fs.readFileSync(quizHtmlPath, 'utf8');
  assert(quizHtml.includes('index.html#quiz'), 'quiz.html redirects to index.html#quiz');
  assert(quizHtml.includes('window.location.replace'), 'quiz.html uses window.location.replace for seamless navigation');
}

// C. Dedicated Quiz Client Logic (js/quiz.js)
const quizJsPath = path.join(__dirname, 'js', 'quiz.js');
assert(fs.existsSync(quizJsPath), 'js/quiz.js exists');
if (fs.existsSync(quizJsPath)) {
  const quizJs = fs.readFileSync(quizJsPath, 'utf8');
  assert(quizJs.includes('openQuizModal'), 'js/quiz.js implements openQuizModal');
  assert(quizJs.includes('closeQuizModal'), 'js/quiz.js implements closeQuizModal');
  assert(quizJs.includes('submit_quiz_registration'), 'js/quiz.js calls submit_quiz_registration RPC');
  assert(quizJs.includes('is_duplicate'), 'js/quiz.js handles duplicate submission response');
  assert(quizJs.includes('quiz-copy-ref-btn'), 'js/quiz.js provides reference copying functionality');
  assert(quizJs.includes('quiz-dialog'), 'js/quiz.js targets #quiz-dialog modal');
  assert(quizJs.includes('overflow = \'hidden\''), 'js/quiz.js manages body scroll locking on open');
  assert(quizJs.includes('overflow = \'\''), 'js/quiz.js restores body scroll on close');
}

// D. Public Site Integration (index.html)
const indexPath = path.join(__dirname, 'index.html');
assert(fs.existsSync(indexPath), 'index.html exists');
if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  assert(indexHtml.includes('js/quiz.js'), 'index.html includes js/quiz.js script tag');
  assert(indexHtml.includes('id="quiz-dialog"'), 'index.html includes #quiz-dialog modal element');
  assert(indexHtml.includes('class="reg-dialog glass"'), 'index.html uses standard .reg-dialog.glass styling for quiz modal');
  assert(indexHtml.includes('id="quiz-close-x"'), 'index.html includes #quiz-close-x button');
  assert(indexHtml.includes('id="quiz-form-view"'), 'index.html includes #quiz-form-view section');
  assert(indexHtml.includes('id="quiz-registration-form"'), 'index.html contains #quiz-registration-form');
  assert(indexHtml.includes('id="quiz-fullname"'), 'index.html contains #quiz-fullname input');
  assert(indexHtml.includes('id="quiz-mobile"'), 'index.html contains #quiz-mobile input');
  assert(indexHtml.includes('id="quiz-email"'), 'index.html contains #quiz-email input');
  assert(indexHtml.includes('id="quiz-inst-combobox"'), 'index.html contains #quiz-inst-combobox');
  assert(indexHtml.includes('id="quiz-inst-search"'), 'index.html contains #quiz-inst-search combobox input');
  assert(indexHtml.includes('id="quiz-course"'), 'index.html contains #quiz-course input');
  assert(indexHtml.includes('id="quiz-district"'), 'index.html contains #quiz-district input');
  assert(indexHtml.includes('id="quiz-consent"'), 'index.html contains #quiz-consent checkbox');
  assert(indexHtml.includes('id="quiz-submit-btn"'), 'index.html contains #quiz-submit-btn');
  assert(indexHtml.includes('id="quiz-success-view"'), 'index.html contains #quiz-success-view');
  assert(indexHtml.includes('id="quiz-success-ref"'), 'index.html contains #quiz-success-ref');
  assert(indexHtml.includes('id="quiz-copy-ref-btn"'), 'index.html contains #quiz-copy-ref-btn');
  assert(indexHtml.includes('id="quiz-print-btn"'), 'index.html contains #quiz-print-btn');
  assert(indexHtml.includes('id="quiz-done-btn"'), 'index.html contains #quiz-done-btn');
  assert(indexHtml.includes('class="nav-quiz"'), 'index.html contains .nav-quiz navbar trigger');
  assert(indexHtml.includes('class="btn hero-quiz-btn"'), 'index.html contains .hero-quiz-btn hero trigger');
  assert(indexHtml.includes('id="quiz-banner"'), 'index.html contains dedicated #quiz-banner section');
  assert(indexHtml.includes('quiz-banner-cta'), 'index.html contains .quiz-banner-cta trigger');
  assert(indexHtml.includes('SCHEDULE = ['), 'index.html retains SCHEDULE array structure');
}

// E. Admin Portals (admin.html and admin/index.html)
const adminHtmlPath = path.join(__dirname, 'admin.html');
const adminIndexPath = path.join(__dirname, 'admin', 'index.html');
assert(fs.existsSync(adminHtmlPath) && fs.existsSync(adminIndexPath), 'Both admin.html and admin/index.html exist');

[adminHtmlPath, adminIndexPath].forEach(p => {
  const rel = path.relative(__dirname, p);
  const html = fs.readFileSync(p, 'utf8');
  assert(html.includes('data-tab="quiz"'), `${rel} contains Quiz Registrations tab button`);
  assert(html.includes('id="stat-quiz-total"'), `${rel} contains #stat-quiz-total in dashboard`);
  assert(html.includes('id="pane-quiz"'), `${rel} contains #pane-quiz tab pane`);
  assert(html.includes('id="quiz-search-input"'), `${rel} contains #quiz-search-input filter`);
  assert(html.includes('id="quiz-status-filter"'), `${rel} contains #quiz-status-filter select`);
  assert(html.includes('id="quiz-date-filter"'), `${rel} contains #quiz-date-filter select`);
  assert(html.includes('id="quiz-table"'), `${rel} contains #quiz-table`);
  assert(html.includes('id="quiz-tbody"'), `${rel} contains #quiz-tbody`);
  assert(html.includes('id="export-quiz-csv-btn"'), `${rel} contains #export-quiz-csv-btn`);
  assert(html.includes('id="quiz-detail-modal"'), `${rel} contains #quiz-detail-modal dialog`);
  assert(html.includes('id="modal-quiz-id"'), `${rel} contains #modal-quiz-id`);
  assert(html.includes('id="modal-quiz-status-select"'), `${rel} contains #modal-quiz-status-select`);
  assert(html.includes('id="modal-quiz-save-status-btn"'), `${rel} contains #modal-quiz-save-status-btn`);
  assert(html.includes('id="modal-quiz-btn-delete"'), `${rel} contains #modal-quiz-btn-delete`);
  assert(html.includes('id="modal-quiz-btn-whatsapp"'), `${rel} contains #modal-quiz-btn-whatsapp`);
});

// F. Admin Logic (js/admin.js)
const adminJsPath = path.join(__dirname, 'js', 'admin.js');
assert(fs.existsSync(adminJsPath), 'js/admin.js exists');
if (fs.existsSync(adminJsPath)) {
  const adminJs = fs.readFileSync(adminJsPath, 'utf8');
  assert(adminJs.includes('allQuizRegistrations'), 'js/admin.js manages allQuizRegistrations state');
  assert(adminJs.includes('loadQuizRegistrations'), 'js/admin.js implements loadQuizRegistrations');
  assert(adminJs.includes('renderQuizTable'), 'js/admin.js implements renderQuizTable');
  assert(adminJs.includes('openQuizDetails'), 'js/admin.js implements openQuizDetails');
  assert(adminJs.includes('saveQuizStatus'), 'js/admin.js implements saveQuizStatus');
  assert(adminJs.includes('confirmDeleteQuizRegistration'), 'js/admin.js implements confirmDeleteQuizRegistration');
  assert(adminJs.includes('openWhatsAppForQuiz'), 'js/admin.js implements openWhatsAppForQuiz');
  assert(adminJs.includes('exportQuizCSV'), 'js/admin.js implements exportQuizCSV');
  assert(adminJs.includes('quiz: \'Quiz Competition Management\''), 'js/admin.js defines Quiz page heading');
}

// -------------------------------------------------------------
// 2. Supabase Live RPC & Security Boundary Tests
// -------------------------------------------------------------
async function testSupabaseSecurityAndRpc() {
  console.log('\n--- 2. SUPABASE SECURITY BOUNDARIES & RPC TESTS ---');
  const { HLF_CONFIG } = require('./js/supabase-config.js');
  const supaUrl = HLF_CONFIG.supabaseUrl;
  const anonKey = HLF_CONFIG.supabaseAnonKey;

  // A. Anonymous client trying to SELECT quiz_registrations directly
  console.log('Testing: Anonymous visitor reading quiz_registrations directly...');
  const directReadRes = await new Promise((resolve) => {
    const parsed = new URL(`${supaUrl}/rest/v1/quiz_registrations?select=*`);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', () => resolve({ status: 500, body: '' }));
    req.end();
  });

  const parsedBody = directReadRes.body ? JSON.parse(directReadRes.body) : [];
  assert(Array.isArray(parsedBody) && parsedBody.length === 0, 'Security: Direct SELECT on quiz_registrations is protected by RLS (returns 0 rows for anonymous visitors)');

  // B. Submit registration via RPC
  const testPhone = '9847' + Math.floor(100000 + Math.random() * 900000);
  console.log(`Testing: Submitting fresh quiz registration for mobile ${testPhone}...`);

  const submitRpcRes = await new Promise((resolve) => {
    const parsed = new URL(`${supaUrl}/rest/v1/rpc/submit_quiz_registration`);
    const postData = JSON.stringify({
      p_full_name: 'Test Candidate',
      p_mobile: testPhone,
      p_institution: 'Darul Huda Islamic University, Chemmad',
      p_email: 'test@hlf2026.org',
      p_course: 'Degree 3rd Year',
      p_department: 'Hadith Studies',
      p_district: 'Malappuram',
      p_notes: 'Integration Test'
    });

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
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status: 500, body: e.message }));
    req.write(postData);
    req.end();
  });

  assert(submitRpcRes.status === 200, `RPC: submit_quiz_registration HTTP status is 200 (got ${submitRpcRes.status})`);
  const rpcData = JSON.parse(submitRpcRes.body);
  assert(rpcData && rpcData.success === true, 'RPC: submit_quiz_registration returns success = true');
  assert(typeof rpcData.quiz_ref === 'string' && rpcData.quiz_ref.startsWith('HLF26-QUIZ-'), `RPC: returns quiz_ref formatted with prefix HLF26-QUIZ- (${rpcData.quiz_ref})`);
  assert(rpcData.is_duplicate === false, 'RPC: new registration has is_duplicate = false');

  // C. Test Duplicate Submission Prevention
  console.log(`Testing: Submitting duplicate registration for same mobile ${testPhone}...`);
  const dupRpcRes = await new Promise((resolve) => {
    const parsed = new URL(`${supaUrl}/rest/v1/rpc/submit_quiz_registration`);
    const postData = JSON.stringify({
      p_full_name: 'Test Candidate Duplicate',
      p_mobile: testPhone,
      p_institution: 'Darul Huda Islamic University, Chemmad'
    });

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
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status: 500, body: e.message }));
    req.write(postData);
    req.end();
  });

  const dupData = JSON.parse(dupRpcRes.body);
  assert(dupData.success === true, 'Duplicate handling: returns success = true');
  assert(dupData.is_duplicate === true, 'Duplicate handling: identifies duplicate registration (is_duplicate = true)');
  assert(dupData.quiz_ref === rpcData.quiz_ref, `Duplicate handling: returns original reference ID (${dupData.quiz_ref})`);

  // D. Verify Anon cannot call update_quiz_registration_status
  console.log('Testing: Anonymous visitor calling admin RPC update_quiz_registration_status...');
  const unauthorizedRpcRes = await new Promise((resolve) => {
    const parsed = new URL(`${supaUrl}/rest/v1/rpc/update_quiz_registration_status`);
    const postData = JSON.stringify({
      p_id: rpcData.id,
      p_status: 'verified'
    });

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
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status: 500, body: e.message }));
    req.write(postData);
    req.end();
  });

  assert(unauthorizedRpcRes.status >= 400, `Security: update_quiz_registration_status correctly rejects anonymous client (status ${unauthorizedRpcRes.status})`);
}

// -------------------------------------------------------------
// 3. Browser Runtime Verification via CDP
// -------------------------------------------------------------
async function runCdpTests() {
  console.log('\n--- 3. BROWSER RUNTIME VERIFICATION VIA CDP ---');

  // Check if local dev server is running on 3300 or start static server
  let serverProcess = null;
  const isServerRunning = await new Promise((resolve) => {
    const req = http.get('http://localhost:3300/index.html', res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
  });

  if (!isServerRunning) {
    console.log('Starting local HTTP server on port 3300...');
    const serve = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, 'http://localhost:3300');
      let filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.webp': 'image/webp'
      };
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      fs.createReadStream(filePath).pipe(res);
    });
    await new Promise(r => serve.listen(3300, r));
    serverProcess = { kill: () => serve.close() };
  }

  // Find Chrome
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  const chromeExe = chromePaths.find(p => fs.existsSync(p));
  if (!chromeExe) {
    console.warn('Chrome binary not found; skipping CDP runtime verification.');
    return;
  }

  const debugPort = 9225;
  const chromeUserData = path.join(__dirname, '.temp_chrome_quiz_test');
  try {
    fs.rmSync(chromeUserData, { recursive: true, force: true });
  } catch (e) {}

  const chromeProc = spawn(chromeExe, [
    `--remote-debugging-port=${debugPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-cache',
    '--disk-cache-size=0',
    '--no-first-run',
    `--user-data-dir=${chromeUserData}`,
    'http://localhost:3300/index.html'
  ]);

  await sleep(2500);

  // Connect to Chrome DevTools Protocol
  const tabs = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${debugPort}/json`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  if (!tabs || tabs.length === 0) {
    throw new Error('No CDP tabs available');
  }

  const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:3300')) || tabs.find(t => t.type === 'page') || tabs[0];
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
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

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
    // 1. Navigate to index.html
    console.log('Navigating to http://localhost:3300/index.html...');
    await send('Page.navigate', { url: 'http://localhost:3300/index.html' });
    await sleep(2500);

    const pageTitle = await evalScript('document.title');
    assert(pageTitle.includes('HLF 2026'), `Browser: index.html loaded with title "${pageTitle}"`);

    // Verify Quiz dialog exists in index.html and is initially closed
    const quizDialogExists = await evalScript('!!document.getElementById("quiz-dialog")');
    assert(quizDialogExists, 'Browser: #quiz-dialog exists in index.html DOM');

    const isInitiallyOpen = await evalScript('document.getElementById("quiz-dialog").open === true');
    assert(!isInitiallyOpen, 'Browser: #quiz-dialog is initially closed');

    // 2. Click hero quiz button to open modal
    console.log('Testing: Clicking .hero-quiz-btn to open modal...');
    await evalScript(`
      const btn = document.querySelector('.hero-quiz-btn');
      if (btn) btn.click();
    `);
    await sleep(600);

    const isOpenAfterHeroClick = await evalScript('document.getElementById("quiz-dialog").open === true');
    assert(isOpenAfterHeroClick, 'Browser: Clicking .hero-quiz-btn opens #quiz-dialog modal');

    const isBodyOverflowHidden = await evalScript('document.body.style.overflow === "hidden"');
    assert(isBodyOverflowHidden, 'Browser: Body scrolling is locked (overflow: hidden) when modal is open');

    // 3. Close modal using close button
    console.log('Testing: Clicking #quiz-close-x to close modal...');
    await evalScript(`
      const closeBtn = document.getElementById('quiz-close-x');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(400);

    const isClosedAfterX = await evalScript('document.getElementById("quiz-dialog").open === false');
    assert(isClosedAfterX, 'Browser: Clicking #quiz-close-x closes #quiz-dialog modal');

    const isBodyOverflowRestored = await evalScript('document.body.style.overflow === ""');
    assert(isBodyOverflowRestored, 'Browser: Body scrolling is restored when modal is closed');

    // 4. Click nav quiz link to open modal
    console.log('Testing: Clicking .nav-quiz to open modal...');
    await evalScript(`
      const navBtn = document.querySelector('.nav-quiz');
      if (navBtn) navBtn.click();
    `);
    await sleep(600);

    const isOpenAfterNavClick = await evalScript('document.getElementById("quiz-dialog").open === true');
    assert(isOpenAfterNavClick, 'Browser: Clicking .nav-quiz opens #quiz-dialog modal');

    // 5. Fill and submit quiz form inside the modal
    const browserMobile = '9744' + Math.floor(100000 + Math.random() * 900000);
    console.log(`Testing: Filling and submitting quiz registration with mobile ${browserMobile}...`);
    await evalScript(`
      document.getElementById('quiz-fullname').value = 'Abdullah ibn Masud';
      document.getElementById('quiz-mobile').value = '${browserMobile}';
      document.getElementById('quiz-email').value = 'abdullah@example.com';
      document.getElementById('quiz-inst-search').value = 'Darul Huda Islamic University, Chemmad';
      document.getElementById('quiz-institution').value = 'Darul Huda Islamic University, Chemmad';
      document.getElementById('quiz-course').value = 'Degree';
      document.getElementById('quiz-department').value = 'Hadith Studies';
      document.getElementById('quiz-district').value = 'Kozhikode';
      document.getElementById('quiz-consent').checked = true;
      document.getElementById('quiz-registration-form').dispatchEvent(new Event('submit', { cancelable: true }));
    `);

    await sleep(3000);

    // 6. Verify success view is displayed inside modal
    const isSuccessVisible = await evalScript('document.getElementById("quiz-success-view").style.display !== "none"');
    assert(isSuccessVisible, 'Browser: #quiz-success-view displayed after form submission inside modal');

    const generatedRef = await evalScript('document.getElementById("quiz-success-ref").textContent');
    assert(typeof generatedRef === 'string' && generatedRef.startsWith('HLF26-QUIZ-'), `Browser: Success view displays generated reference "${generatedRef}"`);

    // 7. Test Copy button feedback inside modal
    await evalScript(`
      const copyBtn = document.getElementById('quiz-copy-ref-btn');
      if (copyBtn) copyBtn.click();
    `);
    await sleep(300);

    const copyFeedbackVisible = await evalScript('document.getElementById("quiz-copy-feedback").style.display !== "none"');
    assert(copyFeedbackVisible, 'Browser: Copy button displays "Copied ✓" feedback');

    // 8. Close modal with Done button
    await evalScript(`
      const doneBtn = document.getElementById('quiz-done-btn');
      if (doneBtn) doneBtn.click();
    `);
    await sleep(400);

    const isClosedAfterDone = await evalScript('document.getElementById("quiz-dialog").open === false');
    assert(isClosedAfterDone, 'Browser: Clicking Done button closes the modal');

    // 9. Verify Delegate Registration is completely independent and untouched
    console.log('Testing: Verifying Delegate Registration (#reg-dialog) remains fully functional...');
    await evalScript(`
      const delBtn = document.querySelector('.hero-reg');
      if (delBtn) delBtn.click();
    `);
    await sleep(600);

    const isRegDialogOpen = await evalScript('document.getElementById("reg-dialog").open === true');
    assert(isRegDialogOpen, 'Browser: Delegate Registration modal (#reg-dialog) opens independently');

    await evalScript(`
      const regClose = document.getElementById('reg-close-x');
      if (regClose) regClose.click();
    `);
    await sleep(400);

    // 10. Test redirect from quiz.html to index.html#quiz
    console.log('Testing: Navigating to http://localhost:3300/quiz.html (redirect test)...');
    await send('Page.navigate', { url: 'http://localhost:3300/quiz.html' });
    await sleep(2500);

    const currentUrl = await evalScript('window.location.href');
    assert(currentUrl.includes('index.html#quiz'), `Browser: quiz.html redirected to index.html#quiz (${currentUrl})`);

    const isModalOpenAfterRedirect = await evalScript('document.getElementById("quiz-dialog").open === true');
    assert(isModalOpenAfterRedirect, 'Browser: #quiz-dialog automatically opened on hash #quiz navigation');

    // 11. Navigate to admin.html and verify quiz tab exists
    console.log('Navigating to http://localhost:3300/admin.html...');
    await send('Page.navigate', { url: 'http://localhost:3300/admin.html' });
    await sleep(2000);

    const hasQuizTab = await evalScript('!!document.querySelector("button[data-tab=\'quiz\']")');
    assert(hasQuizTab, 'Browser: Admin portal has Quiz Registrations navigation button');

    const hasQuizPane = await evalScript('!!document.getElementById("pane-quiz")');
    assert(hasQuizPane, 'Browser: Admin portal has #pane-quiz tab pane');

    const hasQuizExportBtn = await evalScript('!!document.getElementById("export-quiz-csv-btn")');
    assert(hasQuizExportBtn, 'Browser: Admin portal has #export-quiz-csv-btn export button');

    const hasQuizDetailModal = await evalScript('!!document.getElementById("quiz-detail-modal")');
    assert(hasQuizDetailModal, 'Browser: Admin portal has #quiz-detail-modal');

  } finally {
    ws.close();
    chromeProc.kill('SIGKILL');
    if (serverProcess) serverProcess.kill('SIGKILL');
    try {
      fs.rmSync(chromeUserData, { recursive: true, force: true });
    } catch (e) {}
  }
}

// -------------------------------------------------------------
// Main Runner
// -------------------------------------------------------------
async function runAll() {
  try {
    await testSupabaseSecurityAndRpc();
    await runCdpTests();
  } catch (err) {
    console.error('Test execution error:', err);
    testsFailed++;
  } finally {
    console.log('\n================================================================');
    console.log(`FINAL RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log('================================================================');
    if (testsFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runAll();
