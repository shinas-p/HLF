/**
 * HLF 2026 — Limited Seat Progress Bar & Registration Capacity Protection Test Suite
 * 
 * Verifies:
 * 1. Static file structure (HTML, CSS, Admin, JS, Migrations)
 * 2. Supabase RPC get_seat_availability: accurate calculation 12/30 (40%), 18 remaining, privacy
 * 3. Pending registrations do not increment confirmed seat count
 * 4. Safe server-side capacity protection at 30/30 (rejects overbooking)
 * 5. Quiz registrations and Contributions are completely unaffected by delegate seat limit
 * 6. Headless Chrome CDP: DOM rendering, progress bar width, CTA opens modal, full-capacity UI, mobile viewport
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function postJson(urlStr, postData, apiKey) {
  return new Promise((resolve) => {
    const parsed = new URL(urlStr);
    const bodyStr = typeof postData === 'string' ? postData : JSON.stringify(postData);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          resolve({ status: resp.statusCode, data: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ status: resp.statusCode, raw: data });
        }
      });
    });
    req.on('error', (e) => resolve({ error: e }));
    req.write(bodyStr);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('HLF 2026 — SEAT PROGRESS BAR & CAPACITY PROTECTION TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. Static HTML, CSS, Admin & Frontend Verification
  // -------------------------------------------------------------
  console.log('--- 1. STATIC STRUCTURE & STYLING VERIFICATION ---');

  // A. Migration file
  const migPath = path.join(__dirname, 'supabase', 'migrations', '20261013000002_seat_availability_system.sql');
  assert(fs.existsSync(migPath), 'Migration 20261013000002_seat_availability_system.sql exists');
  if (fs.existsSync(migPath)) {
    const migSql = fs.readFileSync(migPath, 'utf8');
    assert(migSql.includes('total_programme_seats') && migSql.includes('DEFAULT 30'), 'Migration adds total_programme_seats column with default 30');
    assert(migSql.includes('baseline_booked_seats') && migSql.includes('DEFAULT 10'), 'Migration adds baseline_booked_seats column with default 10');
    assert(migSql.includes('FUNCTION public.get_seat_availability()'), 'Migration defines get_seat_availability RPC');
    assert(migSql.includes('All seats are booked. Delegate registration is currently full.'), 'Migration enforces server-side capacity check in initiate_registration');
    assert(migSql.includes('FUNCTION public.set_programme_seat_settings'), 'Migration defines set_programme_seat_settings RPC');
  }

  // B. Homepage HTML
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(indexHtml.includes('id="hero-seat-card"'), 'index.html contains #hero-seat-card component');
  assert(indexHtml.includes('LIMITED SEATS AVAILABLE'), 'index.html contains initial "LIMITED SEATS AVAILABLE" tag');
  assert(indexHtml.includes('12 of 30 seats booked') || (indexHtml.includes('id="seat-booked-num"') && indexHtml.includes('id="seat-total-num"')), 'index.html contains seat count numbers');
  assert(indexHtml.includes('18 seats remaining'), 'index.html contains "18 seats remaining" badge');
  assert(indexHtml.includes('id="hero-seat-fill"'), 'index.html contains #hero-seat-fill progress bar element');
  assert(indexHtml.includes('id="seat-reg-cta"'), 'index.html contains #seat-reg-cta button');
  assert(indexHtml.includes('Register Now →'), 'index.html contains "Register Now →" CTA label');

  // C. CSS styles
  const regCss = fs.readFileSync(path.join(__dirname, 'css', 'registration.css'), 'utf8');
  assert(regCss.includes('.hero-seat-card'), 'css/registration.css defines .hero-seat-card');
  assert(regCss.includes('.hero-seat-fill'), 'css/registration.css defines .hero-seat-fill');
  assert(regCss.includes('.hero-seat-card.is-full'), 'css/registration.css defines full capacity state styling');
  assert(regCss.includes('@media (prefers-reduced-motion: reduce)'), 'css/registration.css respects prefers-reduced-motion');
  assert(regCss.includes('@media (max-width: 600px)') || regCss.includes('@media (max-width: 768px)'), 'css/registration.css provides mobile responsive styles');

  // D. Admin Portals
  const adminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
  const adminIndex = fs.readFileSync(path.join(__dirname, 'admin', 'index.html'), 'utf8');
  assert(adminHtml.includes('id="stat-seats-booked"'), 'admin.html has Programme Seats stat card (#stat-seats-booked)');
  assert(adminIndex.includes('id="stat-seats-booked"'), 'admin/index.html has Programme Seats stat card (#stat-seats-booked)');
  assert(adminHtml.includes('id="set-total-seats"') && adminHtml.includes('id="set-baseline-seats"'), 'admin.html has seat configuration fields');
  assert(adminIndex.includes('id="set-total-seats"') && adminIndex.includes('id="set-baseline-seats"'), 'admin/index.html has seat configuration fields');

  // E. Admin JS
  const adminJs = fs.readFileSync(path.join(__dirname, 'js', 'admin.js'), 'utf8');
  assert(adminJs.includes('updateSeatAvailabilityCard'), 'js/admin.js implements updateSeatAvailabilityCard');
  assert(adminJs.includes('set-total-seats'), 'js/admin.js loads and binds set-total-seats');
  assert(adminJs.includes('set-baseline-seats'), 'js/admin.js loads and binds set-baseline-seats');

  // -------------------------------------------------------------
  // 2. Supabase RPC & Accurate Seat Calculation Testing
  // -------------------------------------------------------------
  console.log('\n--- 2. SUPABASE SEAT AVAILABILITY RPC & PRIVACY TEST ---');

  const supaUrl = HLF_CONFIG.supabaseUrl;
  const anonKey = HLF_CONFIG.supabaseAnonKey;

  const rpcRes = await postJson(`${supaUrl}/rest/v1/rpc/get_seat_availability`, {}, anonKey);
  assert(rpcRes.status === 200, `get_seat_availability RPC succeeds (HTTP ${rpcRes.status})`);
  assert(rpcRes.data && rpcRes.data.success === true, 'RPC response success flag is true');
  assert(rpcRes.data.total_seats === 30, `Total programme seats = 30 (got: ${rpcRes.data.total_seats})`);
  assert(rpcRes.data.booked_seats === 12, `Booked seats = 12 (got: ${rpcRes.data.booked_seats})`);
  assert(rpcRes.data.remaining_seats === 18, `Remaining seats = 18 (got: ${rpcRes.data.remaining_seats})`);
  assert(rpcRes.data.booking_progress === 40, `Booking progress = 40% (got: ${rpcRes.data.booking_progress}%)`);
  assert(rpcRes.data.is_full === false, 'is_full is false');

  // Privacy check: no candidate names, phones, emails in response
  const keys = Object.keys(rpcRes.data);
  const forbiddenKeys = ['participants', 'delegates', 'names', 'emails', 'phones', 'records'];
  const hasPrivateData = forbiddenKeys.some(k => keys.includes(k));
  assert(!hasPrivateData, 'RPC response returns only aggregate count, zero private candidate details exposed');

  // -------------------------------------------------------------
  // 3. Counting Rules: Pending / Abandoned registrations do NOT count
  // -------------------------------------------------------------
  console.log('\n--- 3. VERIFY PENDING REGISTRATIONS DO NOT INCREMENT SEATS ---');

  const testDelegateMobile = '9847' + Math.floor(100000 + Math.random() * 900000);
  const initRes = await postJson(`${supaUrl}/rest/v1/rpc/initiate_registration`, {
    p_full_name: 'Seat Test Participant Pending',
    p_mobile: testDelegateMobile,
    p_institution: 'Darul Huda Islamic University',
    p_email: 'pending_seat_test@hlf.org',
    p_course: 'Hadith Studies',
    p_department: 'PG',
    p_district: 'Malappuram'
  }, anonKey);

  assert(initRes.status === 200 && initRes.data && initRes.data.registration_id, `Successfully initiated pending registration (${initRes.data ? initRes.data.registration_id : 'N/A'})`);

  // Check that booked seats is STILL 12 (pending doesn't count towards booked seats)
  const afterPendingRpc = await postJson(`${supaUrl}/rest/v1/rpc/get_seat_availability`, {}, anonKey);
  assert(afterPendingRpc.data.booked_seats === 12, `Booked seats remains 12 after pending registration (got: ${afterPendingRpc.data.booked_seats})`);
  assert(afterPendingRpc.data.remaining_seats === 18, `Remaining seats remains 18 (got: ${afterPendingRpc.data.remaining_seats})`);

  // -------------------------------------------------------------
  // 4. Server-Side Registration Capacity Protection (30/30)
  // -------------------------------------------------------------
  console.log('\n--- 4. SERVER-SIDE CAPACITY PROTECTION (OVERBOOKING PREVENTION) ---');

  // Set baseline_booked_seats to 28 via set_programme_seat_settings RPC so that 28 + 2 verified online = 30 (Full Capacity)
  const setCapRes = await postJson(`${supaUrl}/rest/v1/rpc/set_programme_seat_settings`, {
    p_total_seats: 30,
    p_baseline_booked_seats: 28
  }, anonKey);
  assert(setCapRes.status === 200, 'Configured test capacity to 30/30');

  const fullCapacityRpc = await postJson(`${supaUrl}/rest/v1/rpc/get_seat_availability`, {}, anonKey);
  assert(fullCapacityRpc.data.booked_seats === 30, `At capacity: Booked seats = 30 (got: ${fullCapacityRpc.data.booked_seats})`);
  assert(fullCapacityRpc.data.remaining_seats === 0, `At capacity: Remaining seats = 0 (got: ${fullCapacityRpc.data.remaining_seats})`);
  assert(fullCapacityRpc.data.booking_progress === 100, `At capacity: Progress = 100% (got: ${fullCapacityRpc.data.booking_progress}%)`);
  assert(fullCapacityRpc.data.is_full === true, 'At capacity: is_full flag is true');

  // Attempt to initiate a delegate registration when full — server must reject safely
  const rejectedAttempt = await postJson(`${supaUrl}/rest/v1/rpc/initiate_registration`, {
    p_full_name: 'Overcapacity Test Participant',
    p_mobile: '9847111222',
    p_institution: 'Darul Huda Islamic University',
    p_email: 'overcapacity@hlf.org'
  }, anonKey);

  const isRejectedByCapacity = rejectedAttempt.status >= 400 || (rejectedAttempt.raw && rejectedAttempt.raw.includes('All seats are booked'));
  assert(isRejectedByCapacity, `Server rejects registration when capacity is full (HTTP ${rejectedAttempt.status}: "${rejectedAttempt.data ? rejectedAttempt.data.message : rejectedAttempt.raw}")`);

  // Verify Quiz Registration is NOT blocked by delegate seat capacity
  const quizAttempt = await postJson(`${supaUrl}/rest/v1/rpc/submit_quiz_registration`, {
    p_full_name: 'Quiz Test Delegate When Seats Full',
    p_mobile: '9847' + Math.floor(100000 + Math.random() * 900000),
    p_institution: 'Darul Huda Islamic University, Chemmad',
    p_email: 'quiz_full_test@hlf.org',
    p_course: 'Degree 3rd Year',
    p_department: 'Hadith Studies',
    p_district: 'Malappuram',
    p_notes: 'Integration Test'
  }, anonKey);

  const quizSucceeded = quizAttempt.status === 200 && quizAttempt.data && (quizAttempt.data.quiz_ref || quizAttempt.data.registration_reference || quizAttempt.data.success);
  assert(quizSucceeded, `Quiz competition is NOT restricted by 30-seat delegate limit (Ref: ${quizAttempt.data ? (quizAttempt.data.quiz_ref || quizAttempt.data.registration_reference) : 'N/A'})`);

  // Restore baseline_booked_seats back to 10 (10 + 2 = 12 confirmed seats)
  await postJson(`${supaUrl}/rest/v1/rpc/set_programme_seat_settings`, {
    p_total_seats: 30,
    p_baseline_booked_seats: 10
  }, anonKey);

  const restoredRpc = await postJson(`${supaUrl}/rest/v1/rpc/get_seat_availability`, {}, anonKey);
  assert(restoredRpc.data.booked_seats === 12 && restoredRpc.data.remaining_seats === 18, 'Restored baseline settings: 12 booked, 18 remaining (40%)');

  // -------------------------------------------------------------
  // 5. Headless Chrome CDP Live Browser Rendering & Interaction
  // -------------------------------------------------------------
  console.log('\n--- 5. LIVE BROWSER CDP: RENDERING, CTA MODAL & RESPONSIVENESS ---');

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  let chromeExe = chromePaths.find(p => fs.existsSync(p));
  if (!chromeExe) {
    console.warn('Chrome executable not found. Skipping live CDP tests.');
    finishTests();
    return;
  }

  const debugPort = 9235;
  const chromeProc = spawn(chromeExe, [
    `--remote-debugging-port=${debugPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-cache',
    '--disk-cache-size=0',
    '--user-data-dir=' + path.join(__dirname, '.temp-cdp-profile-seats')
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
    console.warn('Could not connect to Chrome port. Skipping browser interaction.');
    chromeProc.kill();
    finishTests();
    return;
  }

  const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
  const ws = new globalThis.WebSocket(pageTab.webSocketDebuggerUrl);

  let msgId = 1;
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
      const reqId = msgId++;
      pending.set(reqId, resolve);
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:3300/index.html' });
  await sleep(3000);

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
    // 1. Verify Card exists and rendered on screen
    const cardRendered = await evalScript(`
      (() => {
        const card = document.getElementById('hero-seat-card');
        return Boolean(card && card.offsetParent !== null);
      })()
    `);
    assert(cardRendered, 'Browser: #hero-seat-card is visible in the viewport');

    // 2. Verify Exact UI labels
    const tagText = await evalScript('document.getElementById("seat-tag-label").textContent.trim()');
    assert(tagText === 'LIMITED SEATS AVAILABLE', `Browser: Tag is "LIMITED SEATS AVAILABLE" (got: "${tagText}")`);

    const bookedNum = await evalScript('document.getElementById("seat-booked-num").textContent.trim()');
    const totalNum = await evalScript('document.getElementById("seat-total-num").textContent.trim()');
    assert(bookedNum === '12' && totalNum === '30', `Browser: Displays "12" of "30" seats booked (got: ${bookedNum} / ${totalNum})`);

    const remainingText = await evalScript('document.getElementById("seat-remaining-badge").textContent.trim()');
    assert(remainingText.includes('18 seats remaining'), `Browser: Remaining badge shows "18 seats remaining" (got: "${remainingText}")`);

    const fillWidth = await evalScript('document.getElementById("hero-seat-fill").style.width');
    assert(fillWidth === '40%', `Browser: Progress bar fill style width is "40%" (got: "${fillWidth}")`);

    const ctaText = await evalScript('document.getElementById("seat-cta-label").textContent.trim()');
    assert(ctaText === 'Register Now →', `Browser: CTA text is "Register Now →" (got: "${ctaText}")`);

    // 3. Test Clicking CTA opens Delegate Registration modal
    await evalScript('document.getElementById("seat-reg-cta").click()');
    await sleep(600);
    const isModalOpen = await evalScript(`
      (() => {
        const diag = document.getElementById('reg-dialog');
        return Boolean(diag && (diag.open === true || diag.hasAttribute('open')));
      })()
    `);
    assert(isModalOpen, 'Browser: Clicking "Register Now →" opens existing Delegate Registration modal (#reg-dialog)');

    // Close modal
    await evalScript(`
      (() => {
        const diag = document.getElementById('reg-dialog');
        if (diag && typeof diag.close === 'function') diag.close();
      })()
    `);
    await sleep(300);

    // 4. Test UI rendering at full capacity (30/30)
    await evalScript(`
      window.renderSeatAvailabilityUI({
        success: true,
        total_seats: 30,
        booked_seats: 30,
        remaining_seats: 0,
        booking_progress: 100,
        is_full: true
      });
    `);
    await sleep(300);

    const fullTagText = await evalScript('document.getElementById("seat-tag-label").textContent.trim()');
    const fullBadgeText = await evalScript('document.getElementById("seat-remaining-badge").textContent.trim()');
    const fullCtaText = await evalScript('document.getElementById("seat-cta-label").textContent.trim()');
    const isCardFullClass = await evalScript('document.getElementById("hero-seat-card").classList.contains("is-full")');
    const isCtaDisabled = await evalScript('document.getElementById("seat-reg-cta").getAttribute("aria-disabled") === "true"');

    assert(fullTagText === 'ALL SEATS BOOKED', `Browser (Full): Tag changed to "ALL SEATS BOOKED" (got: "${fullTagText}")`);
    assert(fullBadgeText.includes('Full Capacity'), `Browser (Full): Remaining badge shows full capacity (got: "${fullBadgeText}")`);
    assert(fullCtaText === 'All Seats Booked', `Browser (Full): CTA text changed to "All Seats Booked" (got: "${fullCtaText}")`);
    assert(isCardFullClass, 'Browser (Full): Card has .is-full class');
    assert(isCtaDisabled, 'Browser (Full): CTA button has aria-disabled="true"');

    // 5. Test Mobile viewport responsiveness (375px width iPhone SE)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(400);

    const mobileFits = await evalScript(`
      (() => {
        const card = document.getElementById('hero-seat-card');
        const rect = card.getBoundingClientRect();
        return rect.width <= 375 && rect.left >= 0 && (rect.left + rect.width) <= 375 + 20;
      })()
    `);
    assert(mobileFits, 'Browser: Seat availability component fits cleanly within mobile viewport (375px width)');

  } catch (err) {
    console.error('Browser CDP test failed:', err);
    testsFailed++;
  } finally {
    try {
      ws.close();
      chromeProc.kill();
    } catch (e) { }
    finishTests();
  }
}

function finishTests() {
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('================================================================\n');

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests();
