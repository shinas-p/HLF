const fs = require('fs');
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

console.log('================================================================');
console.log('HLF 2026 — UPI PAYMENT FLOW, STATE PRESERVATION & COPY FALLBACK');
console.log('REGRESSION TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ FAIL: ${description}`);
    console.error(`  Error: ${err.message}\n`);
  }
}

async function asyncTest(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ FAIL: ${description}`);
    console.error(`  Error: ${err.message}\n`);
  }
}

const REQUIRED_DISCLAIMER = 'If you are unable to complete your payment using the UPI payment button, or your UPI app displays a warning or payment error, you can copy our official UPI ID and pay manually from your preferred UPI app. Open Google Pay, Paytm, PhonePe, or another supported UPI app, choose the option to pay using a UPI ID, and enter the copied ID. Before paying, verify that the displayed recipient name and amount are correct. If the warning persists or the recipient details do not match, do not proceed; contact the HLF organizers for assistance.';

function norm(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

// -----------------------------------------------------------------
// 1. STATIC CODE & CONFIGURATION INTEGRITY
// -----------------------------------------------------------------
const regJs = fs.readFileSync('js/registration.js', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const regCss = fs.readFileSync('css/registration.css', 'utf8');
const sbConfig = fs.readFileSync('js/supabase-config.js', 'utf8');
const adminJs = fs.readFileSync('js/admin.js', 'utf8');

test('js/supabase-config.js: Official default UPI ID is 9847411637@kotakbank and payee is SHINAS', () => {
  assert(sbConfig.includes("upiId: '9847411637@kotakbank'"), 'supabase-config.js missing official upiId');
  assert(sbConfig.includes("payeeName: 'SHINAS'"), 'supabase-config.js missing official payeeName');
});

test('index.html: Fallback PAYMENT_CONFIG contains 9847411637@kotakbank and SHINAS', () => {
  assert(indexHtml.includes('9847411637@kotakbank'), 'index.html missing 9847411637@kotakbank');
  assert(indexHtml.includes('"SHINAS"'), 'index.html missing SHINAS payee');
});

test('index.html: Legacy payment dialog #pd contains exact Payment Help disclaimer', () => {
  assert(norm(indexHtml).includes(norm(REQUIRED_DISCLAIMER)), 'index.html missing exact required disclaimer');
  assert(indexHtml.includes('Payment Help'), 'index.html missing Payment Help header');
});

test('index.html: Copy button #cp has type="button" and clipboard fallback', () => {
  assert(indexHtml.includes('type="button"') && indexHtml.includes('id="cp"'), 'index.html #cp missing type="button"');
  assert(indexHtml.includes('navigator.clipboard.writeText'), 'index.html #cp missing navigator.clipboard');
  assert(indexHtml.includes('document.execCommand("copy")'), 'index.html #cp missing execCommand fallback');
});

test('css/registration.css: Payment disclaimer and copy button styling exist', () => {
  assert(regCss.includes('.reg-payment-disclaimer'), 'CSS missing .reg-payment-disclaimer');
  assert(regCss.includes('.disclaimer-header'), 'CSS missing .disclaimer-header');
  assert(regCss.includes('.disclaimer-icon'), 'CSS missing .disclaimer-icon');
  assert(regCss.includes('.disclaimer-text'), 'CSS missing .disclaimer-text');
  assert(regCss.includes('.copy-feedback-msg'), 'CSS missing .copy-feedback-msg');
});

test('js/registration.js: Delegate Registration Step 2 contains exact Payment Help disclaimer', () => {
  assert(norm(regJs).includes(norm(REQUIRED_DISCLAIMER)), 'registration.js missing exact required disclaimer');
  const regDiscIdx = regJs.indexOf('id="reg-payment-disclaimer"');
  assert(regDiscIdx !== -1, 'reg-payment-disclaimer element not found');
  const regDiscBlock = regJs.substring(regDiscIdx, regDiscIdx + 1200);
  assert(norm(regDiscBlock).includes(norm(REQUIRED_DISCLAIMER)), 'Registration Step 2 disclaimer text mismatch');
  assert(regDiscBlock.includes('Payment Help'), 'Registration Step 2 missing Payment Help heading');
});

test('js/registration.js: Contribution Step 2 contains exact Payment Help disclaimer', () => {
  assert(norm(regJs).includes(norm(REQUIRED_DISCLAIMER)), 'registration.js missing exact required disclaimer');
  const contribDiscIdx = regJs.indexOf('id="contrib-payment-disclaimer"');
  assert(contribDiscIdx !== -1, 'contrib-payment-disclaimer element not found');
  const contribDiscBlock = regJs.substring(contribDiscIdx, contribDiscIdx + 1200);
  assert(norm(contribDiscBlock).includes(norm(REQUIRED_DISCLAIMER)), 'Contribution Step 2 disclaimer text mismatch');
  assert(contribDiscBlock.includes('Payment Help'), 'Contribution Step 2 missing Payment Help heading');
});

test('js/registration.js: Dedicated Copy UPI ID buttons exist with type="button" and feedback span', () => {
  assert(regJs.includes('id="reg-copy-upi-btn"'), 'Registration missing reg-copy-upi-btn');
  assert(regJs.includes('type="button" class="reg-btn-sm" id="reg-copy-upi-btn"'), 'reg-copy-upi-btn missing type="button"');
  assert(regJs.includes('id="reg-copy-feedback"'), 'Registration missing reg-copy-feedback');
  assert(regJs.includes('id="contrib-copy-upi-btn"'), 'Contribution missing contrib-copy-upi-btn');
  assert(regJs.includes('type="button" class="reg-btn-sm" id="contrib-copy-upi-btn"'), 'contrib-copy-upi-btn missing type="button"');
  assert(regJs.includes('id="contrib-copy-feedback"'), 'Contribution missing contrib-copy-feedback');
});

test('js/registration.js: UPI payment intent buttons do NOT have target="_blank"', () => {
  const regIntentMatch = regJs.match(/id="reg-pay-intent-btn"[^>]*>/);
  assert(regIntentMatch, 'reg-pay-intent-btn not found in DOM template');
  assert(!regIntentMatch[0].includes('target="_blank"'), 'reg-pay-intent-btn must not have target="_blank"');

  const contribIntentMatch = regJs.match(/id="contrib-pay-intent-btn"[^>]*>/);
  assert(contribIntentMatch, 'contrib-pay-intent-btn not found in DOM template');
  assert(!contribIntentMatch[0].includes('target="_blank"'), 'contrib-pay-intent-btn must not have target="_blank"');
});

test('js/registration.js: Copy logic uses Clipboard API with execCommand fallback and truthful feedback', () => {
  assert(regJs.includes('function copyUpiIdToClipboard('), 'copyUpiIdToClipboard function missing');
  assert(regJs.includes('navigator.clipboard') && regJs.includes('writeText'), 'navigator.clipboard.writeText missing');
  assert(regJs.includes('document.execCommand') && regJs.includes('copy'), 'execCommand copy fallback missing');
  assert(regJs.includes('UPI ID copied') || regJs.includes('UPI ID copied ✓'), 'Truthful success feedback missing');
  assert(regJs.includes('Could not auto-copy. Please manually copy'), 'Truthful failure fallback feedback missing');
});

test('js/registration.js: Dual storage draft persistence handles mobile browser lifecycle and page reload', () => {
  assert(regJs.includes('saveRegistrationDraft'), 'saveRegistrationDraft missing');
  assert(regJs.includes('restoreRegistrationDraft'), 'restoreRegistrationDraft missing');
  assert(regJs.includes('clearRegistrationDraft'), 'clearRegistrationDraft missing');
  assert(regJs.includes('saveContributionDraft'), 'saveContributionDraft missing');
  assert(regJs.includes('restoreContributionDraft'), 'restoreContributionDraft missing');
  assert(regJs.includes('clearContributionDraft'), 'clearContributionDraft missing');
  assert(regJs.includes('pageshow'), 'pageshow lifecycle event listener missing');
  assert(regJs.includes('visibilitychange'), 'visibilitychange lifecycle listener missing');
  assert(regJs.includes('sessionStorage'), 'sessionStorage storage fallback missing');
  assert(regJs.includes('localStorage'), 'localStorage storage fallback missing');
});

test('js/registration.js: Prevent duplicate registrations upon draft return or retry', () => {
  assert(regJs.includes('activeRegistrationData ? activeRegistrationData.registration_id : null'), 'Check for existing active registration_id missing');
  assert(regJs.includes('if (!regId) {'), 'Only call initiate_registration when regId is not already set');
});

test('js/registration.js: Verification integrity preserved (no automatic verification on UPI app launch/return)', () => {
  assert(!regJs.includes("payment_status = 'PAID'") && !regJs.includes("payment_status = 'VERIFIED'"), 'Found illegal automatic verification status assignment');
  assert(regJs.includes("payment_status: 'SUBMITTED'"), 'Preserved SUBMITTED status requiring admin review');
  assert(regJs.includes('hlf-payment-proofs'), 'Registration payment screenshot upload bucket preserved');
  assert(regJs.includes('hlf-contribution-payment-proofs'), 'Contribution payment screenshot upload bucket preserved');
});

test('js/admin.js: Festival settings fallback configured to official 9847411637@kotakbank and SHINAS', () => {
  assert(adminJs.includes("data.upi_id || '9847411637@kotakbank'"), 'admin.js missing 9847411637@kotakbank fallback');
  assert(adminJs.includes("data.upi_payee_name || 'SHINAS'"), 'admin.js missing SHINAS fallback');
});

// -----------------------------------------------------------------
// 2. LIVE BROWSER / CDP AUTOMATED TESTING VIA HEADLESS CHROME
// -----------------------------------------------------------------
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.resolve('C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\0414d3e2-796e-41c7-a507-3fd9cc25c7a0\\scratch\\chrome_test_profile_active');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runBrowserTests() {
  if (!fs.existsSync(CHROME_PATH)) {
    console.log('Skipping Chrome CDP test: Chrome executable not found at path.');
    return;
  }

  console.log('\n--- LAUNCHING HEADLESS CHROME FOR LIVE CDP RUNTIME TESTS ---');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9228',
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank'
  ], { detached: false });

  try {
    let tabs = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9228/json');
        tabs = await res.json();
        if (tabs && tabs.length > 0) break;
      } catch (e) {
        await sleep(500);
      }
    }

    if (!tabs || tabs.length === 0) {
      throw new Error('Could not connect to Chrome DevTools port 9228');
    }

    const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
    const ws = new globalThis.WebSocket(pageTab.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    let loadResolve = null;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Page.loadEventFired' && loadResolve) {
        loadResolve();
        loadResolve = null;
      }
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

    async function navigateTo(url) {
      const loadPromise = new Promise(resolve => { loadResolve = resolve; });
      await send('Page.enable');
      await send('Page.navigate', { url });
      await loadPromise;
      await sleep(1000);
    }

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

    // Navigate to local website
    await navigateTo('http://localhost:3300/');

    await asyncTest('Browser: Page loads successfully and window.HLF_CONFIG is populated', async () => {
      const title = await evalScript('document.title');
      assert(title.includes('HLF 2026'), 'Document title does not contain HLF 2026: ' + title);
      const upiId = await evalScript('(window.HLF_CONFIG && window.HLF_CONFIG.payment && window.HLF_CONFIG.payment.upiId) || ""');
      assert.strictEqual(upiId, '9847411637@kotakbank', 'HLF_CONFIG upiId mismatch');
      const payee = await evalScript('(window.HLF_CONFIG && window.HLF_CONFIG.payment && window.HLF_CONFIG.payment.payeeName) || ""');
      assert.strictEqual(payee, 'SHINAS', 'HLF_CONFIG payee mismatch');
    });

    await asyncTest('Browser: Registration Modal opens and injects Step 1 & Step 2 structures', async () => {
      await evalScript('window.openRegistrationModal()');
      const isOpen = await evalScript('document.getElementById("reg-dialog").open === true');
      assert(isOpen, 'Registration modal is not open');
      const disclaimerText = await evalScript('document.querySelector("#reg-step2-view .disclaimer-text").innerText');
      assert(disclaimerText.includes('If you are unable to complete your payment using the UPI payment button'), 'Step 2 disclaimer missing');
    });

    await asyncTest('Browser: Registration Step 1 form submission transitions to Step 2 and builds valid UPI Intent', async () => {
      await evalScript(`
        document.getElementById('reg-fullname').value = 'Ahmed Al-Huda';
        document.getElementById('reg-mobile').value = '9876543210';
        document.getElementById('reg-email').value = 'ahmed@example.com';
        document.getElementById('reg-institution').value = 'Darul Huda Islamic University';
        document.getElementById('reg-institution-search').value = 'Darul Huda Islamic University';
        document.getElementById('reg-district').value = 'Malappuram, Kerala';
        document.getElementById('reg-consent').checked = true;
        document.getElementById('hlf-step1-form').dispatchEvent(new Event('submit', { cancelable: true }));
      `);

      await sleep(1500);

      const step2Active = await evalScript('document.getElementById("reg-step2-view").style.display !== "none"');
      assert(step2Active, 'Step 2 view not active after Step 1 submit');

      const intentUrl = await evalScript('document.getElementById("reg-pay-intent-btn").href');
      assert(intentUrl.startsWith('upi://pay?'), 'Intent URL does not use upi://pay');
      assert(intentUrl.includes('pa=9847411637%40kotakbank') || intentUrl.includes('pa=9847411637@kotakbank'), 'Intent URL missing pa=9847411637@kotakbank');
      assert(intentUrl.includes('pn=SHINAS'), 'Intent URL missing pn=SHINAS');
      assert(intentUrl.includes('am=50'), 'Intent URL missing am=50 for delegate registration');

      const intentTarget = await evalScript('document.getElementById("reg-pay-intent-btn").getAttribute("target")');
      assert(!intentTarget, 'reg-pay-intent-btn must not have target="_blank"');

      const displayedUpi = await evalScript('document.getElementById("reg-upi-id-text").textContent');
      assert.strictEqual(displayedUpi, '9847411637@kotakbank', 'Displayed UPI ID mismatch');

      const displayedPayee = await evalScript('document.getElementById("reg-payee-name-text").textContent');
      assert.strictEqual(displayedPayee, 'SHINAS', 'Displayed payee name mismatch');
    });

    await asyncTest('Browser: Copy UPI ID button works and gives truthful feedback without form submit', async () => {
      const clickRes = await evalScript(`
        (async () => {
          const btn = document.getElementById('reg-copy-upi-btn');
          btn.click();
          await new Promise(r => setTimeout(r, 300));
          const feedback = document.getElementById('reg-copy-feedback').textContent || document.getElementById('reg-copy-text').textContent;
          const stillInStep2 = document.getElementById('reg-step2-view').style.display !== 'none';
          return { feedback, stillInStep2 };
        })()
      `);
      assert(clickRes.stillInStep2, 'Clicking copy button caused navigation away from Step 2');
      assert(clickRes.feedback.includes('UPI ID copied') || clickRes.feedback.includes('Could not auto-copy') || clickRes.feedback.includes('copy'), 'Feedback unexpected: ' + clickRes.feedback);
    });

    await asyncTest('Browser: State preservation restores Registration Step 2 after page reload', async () => {
      // Reload page to simulate mobile browser discarding backgrounded tab or user return
      const loadPromise = new Promise(resolve => { loadResolve = resolve; });
      await send('Page.reload');
      await loadPromise;
      await sleep(1500);

      const restoredState = await evalScript(`
        const dialogOpen = document.getElementById('reg-dialog')?.open === true;
        const step2Active = document.getElementById('reg-step2-view')?.style.display !== 'none';
        const nameVal = document.getElementById('reg-fullname')?.value || '';
        const mobileVal = document.getElementById('reg-mobile')?.value || '';
        ({ dialogOpen, step2Active, nameVal, mobileVal });
      `);

      assert(restoredState.dialogOpen, 'Registration dialog was not restored after reload');
      assert(restoredState.step2Active, 'Registration Step 2 view was not restored after reload');
      assert.strictEqual(restoredState.nameVal, 'Ahmed Al-Huda', 'Registration full name lost on reload');
      assert.strictEqual(restoredState.mobileVal, '9876543210', 'Registration mobile lost on reload');

      // Test Step 2 Back button navigation preserves form input values
      await evalScript('document.getElementById("step2-back-btn").click()');
      const step1Active = await evalScript('document.getElementById("reg-step1-view").style.display !== "none"');
      assert(step1Active, 'Back button did not transition back to Step 1');
      const backNameVal = await evalScript('document.getElementById("reg-fullname").value');
      assert.strictEqual(backNameVal, 'Ahmed Al-Huda', 'Back navigation lost registration name');

      // Clean up modal
      await evalScript('window.closeRegistrationModal(); sessionStorage.clear(); localStorage.clear();');
    });

    await asyncTest('Browser: Contribution Modal opens, builds UPI link, disclaimer, and copy button for ₹313 tier', async () => {
      await evalScript('window.openContributionModal(313, "Bronze")');
      const isOpen = await evalScript('document.getElementById("contrib-dialog").open === true');
      assert(isOpen, 'Contribution dialog is not open');

      await evalScript(`
        document.getElementById('contrib-fullname').value = 'Fatima Zahra';
        document.getElementById('contrib-mobile').value = '9123456789';
        document.getElementById('contrib-email').value = 'fatima@example.com';
        document.getElementById('contrib-step1-proceed-btn').click();
      `);

      await sleep(1000);

      const step2Active = await evalScript('document.getElementById("contrib-step2-view").style.display !== "none"');
      assert(step2Active, 'Contribution Step 2 not active after proceed');

      const headerAmount = await evalScript('document.getElementById("contrib-step2-header-amount").textContent');
      assert(headerAmount.includes('313'), 'Contribution Step 2 amount mismatch: ' + headerAmount);

      const intentUrl = await evalScript('document.getElementById("contrib-pay-intent-btn").href');
      assert(intentUrl.startsWith('upi://pay?'), 'Contribution intent URL does not use upi://pay');
      assert(intentUrl.includes('pa=9847411637%40kotakbank') || intentUrl.includes('pa=9847411637@kotakbank'), 'Contribution intent missing pa=9847411637@kotakbank');
      assert(intentUrl.includes('pn=SHINAS'), 'Contribution intent missing pn=SHINAS');
      assert(intentUrl.includes('am=313'), 'Contribution intent missing am=313');

      const intentTarget = await evalScript('document.getElementById("contrib-pay-intent-btn").getAttribute("target")');
      assert(!intentTarget, 'contrib-pay-intent-btn must not have target="_blank"');

      const disclaimerText = await evalScript('document.querySelector("#contrib-step2-view .disclaimer-text").innerText');
      assert(disclaimerText.includes('If you are unable to complete your payment using the UPI payment button'), 'Contribution disclaimer missing');

      const copyBtnRes = await evalScript(`
        (async () => {
          const btn = document.getElementById('contrib-copy-upi-btn');
          btn.click();
          await new Promise(r => setTimeout(r, 300));
          const feedback = document.getElementById('contrib-copy-feedback').textContent || document.getElementById('contrib-copy-text').textContent;
          const stillInStep2 = document.getElementById('contrib-step2-view').style.display !== 'none';
          return { feedback, stillInStep2 };
        })()
      `);
      assert(copyBtnRes.stillInStep2, 'Clicking copy button navigated away from Contribution Step 2');
      assert(copyBtnRes.feedback.includes('UPI ID copied') || copyBtnRes.feedback.includes('Could not auto-copy') || copyBtnRes.feedback.includes('copy'), 'Feedback unexpected: ' + copyBtnRes.feedback);
    });

    await asyncTest('Browser: Contribution draft preserves state across reload and Back button', async () => {
      const loadPromise = new Promise(resolve => { loadResolve = resolve; });
      await send('Page.reload');
      await loadPromise;
      await sleep(1500);

      const restoredState = await evalScript(`
        const dialogOpen = document.getElementById('contrib-dialog')?.open === true;
        const step2Active = document.getElementById('contrib-step2-view')?.style.display !== 'none';
        const nameVal = document.getElementById('contrib-fullname')?.value || '';
        const mobileVal = document.getElementById('contrib-mobile')?.value || '';
        const headerAmount = document.getElementById('contrib-step2-header-amount')?.textContent || '';
        ({ dialogOpen, step2Active, nameVal, mobileVal, headerAmount });
      `);

      assert(restoredState.dialogOpen, 'Contribution dialog was not restored after reload');
      assert(restoredState.step2Active, 'Contribution Step 2 view was not restored after reload');
      assert.strictEqual(restoredState.nameVal, 'Fatima Zahra', 'Contribution name lost on reload');
      assert.strictEqual(restoredState.mobileVal, '9123456789', 'Contribution mobile lost on reload');
      assert(restoredState.headerAmount.includes('313'), 'Contribution amount lost on reload');

      // Test Back button
      await evalScript('document.getElementById("contrib-step2-back-btn").click()');
      const step1Active = await evalScript('document.getElementById("contrib-step1-view").style.display !== "none"');
      assert(step1Active, 'Back button did not transition back to Contribution Step 1');
      const backNameVal = await evalScript('document.getElementById("contrib-fullname").value');
      assert.strictEqual(backNameVal, 'Fatima Zahra', 'Contribution back navigation lost name');

      await evalScript('window.closeContributionModal(); sessionStorage.clear(); localStorage.clear();');
    });

    ws.close();
  } finally {
    try {
      chromeProc.kill();
    } catch (e) {}
  }
}

async function run() {
  await runBrowserTests();
  console.log('\n================================================================');
  console.log(`RESULTS: ${passedTests} of ${totalTests} tests passed!`);
  console.log('================================================================');
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
