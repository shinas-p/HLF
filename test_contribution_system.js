const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('HLF 2026 — CONTRIBUTION SYSTEM INTEGRATION TEST SUITE');
console.log('====================================================\n');

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

// -------------------------------------------------------------
// 1. PUBLIC HTML VERIFICATION (index.html)
// -------------------------------------------------------------
const indexHtml = fs.readFileSync('index.html', 'utf8');

test('index.html: Premium tier is completely removed from TIERS array', () => {
  assert(!indexHtml.includes('["Premium", 1000'), 'Premium tier found in TIERS array!');
  assert(!indexHtml.includes('["Premium",1000'), 'Premium tier found in TIERS array!');
  assert(!indexHtml.includes('Contribute ₹1,000'), 'Contribute ₹1,000 found in index.html!');
});

test('index.html: TIERS contains exactly Minimal (99), Bronze (313), Silver (500), Golden (786)', () => {
  assert(indexHtml.includes('["Minimal", 99, "--red"]'), 'Minimal ₹99 tier missing');
  assert(indexHtml.includes('["Bronze", 313, "--amb"]'), 'Bronze ₹313 tier missing');
  assert(indexHtml.includes('["Silver", 500, "--teal"]'), 'Silver ₹500 tier missing');
  assert(indexHtml.includes('["Golden", 786, "--yel"]'), 'Golden ₹786 tier missing');
});

test('index.html: 4-tier grid (.tiers-4) container exists', () => {
  assert(indexHtml.includes('<div class="tiers-4" id="tiers"></div>'), '.tiers-4 container missing');
});

test('index.html: TOP CONTRIBUTORS card exists with correct heading and subtitle', () => {
  assert(indexHtml.includes('id="contrib-leaderboard-card"'), 'Leaderboard card ID missing');
  assert(indexHtml.includes('TOP CONTRIBUTORS'), 'TOP CONTRIBUTORS title missing');
  assert(indexHtml.includes('Celebrating those who support HLF 2026'), 'Subtitle missing');
  assert(indexHtml.includes('id="contrib-leaderboard-list"'), 'Leaderboard list container missing');
});

test('index.html: HLF 2026 SUPPORT TARGET card exists with figures and progress bar', () => {
  assert(indexHtml.includes('id="contrib-target-card"'), 'Target card ID missing');
  assert(indexHtml.includes('HLF 2026 SUPPORT TARGET'), 'SUPPORT TARGET title missing');
  assert(indexHtml.includes('id="contrib-raised-amount"'), 'Raised amount element missing');
  assert(indexHtml.includes('id="contrib-goal-amount"'), 'Goal amount element missing');
  assert(indexHtml.includes('id="contrib-progress-fill"'), 'Progress bar element missing');
  assert(indexHtml.includes('id="contrib-target-pct"'), 'Percentage element missing');
});

test('index.html: 05 Custom Contribution card exists with Choose Amount button', () => {
  assert(indexHtml.includes('class="custom-contrib-card'), 'Custom contribution card missing');
  assert(indexHtml.includes('<small class="num">05</small>'), '05 number badge missing');
  assert(indexHtml.includes('<h3>Custom</h3>'), 'Custom title missing');
  assert(indexHtml.includes("pay('custom','Custom Contribution')"), 'pay custom call missing');
  assert(indexHtml.includes('Choose Amount ✦'), 'Choose Amount button text missing');
});

test('index.html: loadPublicContributionData function and fallback logic exist', () => {
  assert(indexHtml.includes('async function loadPublicContributionData()'), 'loadPublicContributionData missing');
  assert(indexHtml.includes('const DEFAULT_TARGET = 50000'), 'Default target 50000 fallback missing');
  assert(indexHtml.includes("get_public_contribution_data"), 'RPC call missing');
  assert(indexHtml.includes("renderSupportTargetUI"), 'renderSupportTargetUI missing');
  assert(indexHtml.includes("renderTopContributorsUI"), 'renderTopContributorsUI missing');
});

// -------------------------------------------------------------
// 2. CSS VERIFICATION (css/registration.css)
// -------------------------------------------------------------
const regCss = fs.readFileSync('css/registration.css', 'utf8');

test('css/registration.css: Contribution button animation system (.contrib-btn)', () => {
  assert(regCss.includes('.contrib-btn {'), '.contrib-btn missing');
  assert(regCss.includes('.contrib-btn:hover {'), '.contrib-btn:hover missing');
  assert(regCss.includes('.contrib-btn:active {'), '.contrib-btn:active missing');
  assert(regCss.includes('@keyframes contribBtnShine'), 'Button shine keyframes missing');
  assert(regCss.includes('.contrib-btn::after'), 'Button shine pseudo-element missing');
});

test('css/registration.css: Grid layouts (.tiers-4 and .contrib-community-grid)', () => {
  assert(regCss.includes('.tiers-4 {'), '.tiers-4 style missing');
  assert(regCss.includes('grid-template-columns: repeat(4, 1fr)'), '4 columns missing');
  assert(regCss.includes('.contrib-community-grid {'), '.contrib-community-grid missing');
  assert(regCss.includes('grid-template-columns: 1fr 1fr'), '2-column community grid missing');
});

test('css/registration.css: Progress bar styling (.contrib-progress-fill)', () => {
  assert(regCss.includes('.contrib-progress-track {'), '.contrib-progress-track missing');
  assert(regCss.includes('.contrib-progress-fill {'), '.contrib-progress-fill missing');
  assert(regCss.includes('border-radius: 99px'), 'Rounded track missing');
});

test('css/registration.css: Accessibility and prefers-reduced-motion', () => {
  assert(regCss.includes('@media (prefers-reduced-motion: reduce)'), 'prefers-reduced-motion missing in contribution styles');
});

test('css/registration.css: Responsive breakpoints (900px and 600px)', () => {
  assert(regCss.includes('@media (max-width: 900px)'), '900px breakpoint missing');
  assert(regCss.includes('@media (max-width: 600px)'), '600px breakpoint missing');
});

// -------------------------------------------------------------
// 3. ADMIN PANEL VERIFICATION (admin.html & admin/index.html)
// -------------------------------------------------------------
const adminHtml = fs.readFileSync('admin.html', 'utf8');
const adminIndexHtml = fs.readFileSync('admin/index.html', 'utf8');

test('admin.html: Contribution Settings panel exists in #pane-contributions', () => {
  assert(adminHtml.includes('id="panel-contribution-settings"'), 'panel-contribution-settings missing in admin.html');
  assert(adminHtml.includes('id="contrib-target-form"'), 'contrib-target-form missing in admin.html');
  assert(adminHtml.includes('id="admin-target-amount"'), 'admin-target-amount input missing in admin.html');
  assert(adminHtml.includes('id="save-target-btn"'), 'save-target-btn missing in admin.html');
  assert(adminHtml.includes('id="admin-target-raised"'), 'admin-target-raised element missing in admin.html');
  assert(adminHtml.includes('id="admin-target-pct"'), 'admin-target-pct element missing in admin.html');
  assert(adminHtml.includes('id="admin-target-bar"'), 'admin-target-bar element missing in admin.html');
});

test('admin/index.html: Contribution Settings panel matches admin.html', () => {
  assert(adminIndexHtml.includes('id="panel-contribution-settings"'), 'panel-contribution-settings missing in admin/index.html');
  assert(adminIndexHtml.includes('id="contrib-target-form"'), 'contrib-target-form missing in admin/index.html');
  assert(adminIndexHtml.includes('id="admin-target-amount"'), 'admin-target-amount input missing in admin/index.html');
  assert(adminIndexHtml.includes('id="save-target-btn"'), 'save-target-btn missing in admin/index.html');
  assert(adminIndexHtml.includes('id="admin-target-raised"'), 'admin-target-raised element missing in admin/index.html');
  assert(adminIndexHtml.includes('id="admin-target-pct"'), 'admin-target-pct element missing in admin/index.html');
  assert(adminIndexHtml.includes('id="admin-target-bar"'), 'admin-target-bar element missing in admin/index.html');
});

// -------------------------------------------------------------
// 4. ADMIN JAVASCRIPT VERIFICATION (js/admin.js)
// -------------------------------------------------------------
const adminJs = fs.readFileSync('js/admin.js', 'utf8');

test('js/admin.js: Contribution target management and validation logic', () => {
  assert(adminJs.includes('let currentContributionTarget = 50000'), 'currentContributionTarget variable missing');
  assert(adminJs.includes('async function loadContributionSettings()'), 'loadContributionSettings missing');
  assert(adminJs.includes('function updateAdminTargetProgress()'), 'updateAdminTargetProgress missing');
  assert(adminJs.includes('function setupContributionTargetForm()'), 'setupContributionTargetForm missing');
  assert(adminJs.includes('Contribution target updated successfully.'), 'Save confirmation message missing');
});

test('js/admin.js: Festival settings form preserves donation_goal', () => {
  assert(adminJs.includes('donation_goal: currentContributionTarget'), 'Preservation of donation_goal on settings save missing');
});

// -------------------------------------------------------------
// 5. PROGRESS CALCULATION LOGIC UNIT TESTS
// -------------------------------------------------------------
function calcProgress(raised, target) {
  const safeTarget = (typeof target === 'number' && target > 0) ? target : 50000;
  const safeRaised = (typeof raised === 'number' && raised >= 0) ? raised : 0;
  const rawPct = safeTarget > 0 ? (safeRaised / safeTarget) * 100 : 0;
  const displayPct = rawPct > 0 ? (rawPct >= 100 ? 100 : Math.round(rawPct * 10) / 10) : 0;
  const barPct = Math.min(100, Math.max(0, rawPct));
  return { displayPct, barPct };
}

test('Progress Calc: Zero contributions returns 0%', () => {
  const res = calcProgress(0, 50000);
  assert.strictEqual(res.displayPct, 0);
  assert.strictEqual(res.barPct, 0);
});

test('Progress Calc: 24,500 of 50,000 gives 49%', () => {
  const res = calcProgress(24500, 50000);
  assert.strictEqual(res.displayPct, 49);
  assert.strictEqual(res.barPct, 49);
});

test('Progress Calc: 25,000 of 1,00,000 gives 25%', () => {
  const res = calcProgress(25000, 100000);
  assert.strictEqual(res.displayPct, 25);
  assert.strictEqual(res.barPct, 25);
});

test('Progress Calc: Exceeding target caps display at 100% and bar at 100%', () => {
  const res = calcProgress(60000, 50000);
  assert.strictEqual(res.displayPct, 100);
  assert.strictEqual(res.barPct, 100);
});

test('Progress Calc: Division by zero protection', () => {
  const res = calcProgress(1000, 0);
  // safeTarget defaults to 50000 if 0
  assert(res.displayPct >= 0 && res.displayPct <= 100);
});

// -------------------------------------------------------------
// 6. CURRENCY FORMATTING UNIT TEST
// -------------------------------------------------------------
test('Currency Formatting: Indian Rupee format matches ₹50,000, ₹1,00,000', () => {
  const f50k = '₹' + (50000).toLocaleString('en-IN');
  const f100k = '₹' + (100000).toLocaleString('en-IN');
  const f250k = '₹' + (250000).toLocaleString('en-IN');
  assert.strictEqual(f50k, '₹50,000');
  assert.strictEqual(f100k, '₹1,00,000');
  assert.strictEqual(f250k, '₹2,50,000');
});

console.log(`\n====================================================`);
console.log(`RESULTS: ${passedTests} of ${totalTests} tests passed!`);
console.log(`====================================================`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
