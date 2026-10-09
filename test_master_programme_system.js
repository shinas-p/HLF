/**
 * HLF 2026 — MASTER PROGRAMME MANAGEMENT SYSTEM INTEGRATION TESTS
 */

const fs = require('fs');
const assert = require('assert');
const https = require('https');

console.log('====================================================');
console.log('HLF 2026 — MASTER PROGRAMME MANAGEMENT SYSTEM TEST SUITE');
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

async function runAllTests() {
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const adminIndexHtml = fs.readFileSync('admin/index.html', 'utf8');
  const adminHtml = fs.readFileSync('admin.html', 'utf8');
  const adminJs = fs.readFileSync('js/admin.js', 'utf8');
  const supabaseConfigJs = fs.readFileSync('js/supabase-config.js', 'utf8');

  // -------------------------------------------------------------
  // 1. PUBLIC WEBSITE: ZERO HARDCODED PROGRAMME TITLES (Section 17 & 20)
  // -------------------------------------------------------------
  const officialTitles = [
    "The Prophet ﷺ as Teacher",
    "Hadith Studies in the Digital Age",
    "Why Do Scholars Differ?",
    "Contemporary Trends in Global Hadith Research",
    "മദ്ഹ് താണ്ടിയ കേരളീയ വഴിയോരങ്ങൾ",
    "അഭയം ചൊരിയുന്ന പ്രവാചകൻ",
    "The Eloquence of Prophetic Speech",
    "HADITH LIVE QUIZ PROGRAMME",
    "MEHFIL-E-ISHQ"
  ];

  officialTitles.forEach(title => {
    test(`index.html: Title "${title.slice(0, 30)}" is NOT hardcoded`, () => {
      assert(!indexHtml.includes(title), `Found hardcoded session title in index.html: "${title}"`);
    });
  });

  test('index.html: SCHEDULE items array is initially empty (dynamic loading required)', () => {
    const scheduleMatch = indexHtml.match(/const SCHEDULE\s*=\s*\[([\s\S]*?)\];/);
    assert(scheduleMatch, 'SCHEDULE array not found in index.html');
    const scheduleBody = scheduleMatch[1];
    assert(!scheduleBody.includes('"The Prophet'), 'Hardcoded sessions found inside SCHEDULE array');
    assert(!scheduleBody.includes('Yousuf Hudawi'), 'Hardcoded speaker found inside SCHEDULE array');
  });

  test('index.html: loadScheduleFromDatabase exists and queries Supabase programme tables', () => {
    assert(indexHtml.includes('async function loadScheduleFromDatabase'), 'loadScheduleFromDatabase function missing');
    assert(indexHtml.includes("sb.from('programme_days')"), 'Query to programme_days missing');
    assert(indexHtml.includes("sb.from('programme_items')"), 'Query to programme_items missing');
    assert(indexHtml.includes('renderScheduleItem'), 'renderScheduleItem missing');
  });

  test('index.html: Session cards render cleanly without empty speaker labels', () => {
    assert(!indexHtml.includes('Speaker: N/A'), 'Empty "Speaker: N/A" found in index.html');
    assert(!indexHtml.includes('Speaker:\nN/A'), 'Empty "Speaker: N/A" found in index.html');
    assert(indexHtml.includes('.it.prog-item'), 'CSS class for database-driven prog-item missing');
    assert(indexHtml.includes('.prog-time-badge'), 'CSS class for prog-time-badge missing');
    assert(indexHtml.includes('.prog-person-chip'), 'CSS class for prog-person-chip missing');
  });

  // -------------------------------------------------------------
  // 2. ADMIN PORTAL: PROGRAMME MANAGEMENT ARCHITECTURE (Section 4 & 5)
  // -------------------------------------------------------------
  [
    { name: 'admin/index.html', content: adminIndexHtml },
    { name: 'admin.html', content: adminHtml }
  ].forEach(({ name, content }) => {
    test(`${name}: Festival Days container exists`, () => {
      assert(content.includes('id="programme-days-container"'), 'programme-days-container missing');
      assert(content.includes('id="open-new-day-btn"'), 'open-new-day-btn missing');
    });

    test(`${name}: Session Cards & Table containers exist with view toggle`, () => {
      assert(content.includes('id="programme-cards-container"'), 'programme-cards-container missing');
      assert(content.includes('id="programme-table-wrapper"'), 'programme-table-wrapper missing');
      assert(content.includes('id="prog-view-cards-btn"'), 'prog-view-cards-btn missing');
      assert(content.includes('id="prog-view-table-btn"'), 'prog-view-table-btn missing');
      assert(content.includes('id="prog-search-input"'), 'prog-search-input missing');
    });

    test(`${name}: Upgraded Session Modal contains subject and structured participant manager`, () => {
      assert(content.includes('id="session-modal"'), 'session-modal missing');
      assert(content.includes('id="edit-session-subject"'), 'edit-session-subject missing');
      assert(content.includes('id="edit-session-number"'), 'edit-session-number missing');
      assert(content.includes('id="edit-session-type"'), 'edit-session-type missing');
      assert(content.includes('id="modal-participants-list"'), 'modal-participants-list missing');
      assert(content.includes('id="modal-new-part-name"'), 'modal-new-part-name missing');
      assert(content.includes('id="modal-new-part-role"'), 'modal-new-part-role missing');
      assert(content.includes('id="modal-add-part-btn"'), 'modal-add-part-btn missing');
    });

    test(`${name}: Festival Day Modal exists`, () => {
      assert(content.includes('id="day-modal"'), 'day-modal missing');
      assert(content.includes('id="day-form"'), 'day-form missing');
      assert(content.includes('id="edit-day-number"'), 'edit-day-number missing');
      assert(content.includes('id="edit-day-date"'), 'edit-day-date missing');
      assert(content.includes('id="edit-day-name"'), 'edit-day-name missing');
    });
  });

  // -------------------------------------------------------------
  // 3. ADMIN JAVASCRIPT LOGIC (js/admin.js)
  // -------------------------------------------------------------
  test('js/admin.js: Day management functions implemented', () => {
    assert(adminJs.includes('function openNewDay'), 'openNewDay function missing');
    assert(adminJs.includes('function openEditDay'), 'openEditDay function missing');
    assert(adminJs.includes('async function deleteDay'), 'deleteDay function missing');
    assert(adminJs.includes("sb.from('programme_days').update"), 'programme_days update missing');
    assert(adminJs.includes("sb.from('programme_days').insert"), 'programme_days insert missing');
  });

  test('js/admin.js: Session management functions implemented', () => {
    assert(adminJs.includes('function openNewSession'), 'openNewSession function missing');
    assert(adminJs.includes('function editSession'), 'editSession function missing');
    assert(adminJs.includes('async function deleteSession'), 'deleteSession function missing');
    assert(adminJs.includes("sb.from('programme_items').update"), 'programme_items update missing');
    assert(adminJs.includes("sb.from('programme_items').insert"), 'programme_items insert missing');
  });

  test('js/admin.js: Structured participant management implemented', () => {
    assert(adminJs.includes('function renderModalParticipants'), 'renderModalParticipants missing');
    assert(adminJs.includes('function updateParticipantRole'), 'updateParticipantRole missing');
    assert(adminJs.includes('function removeParticipant'), 'removeParticipant missing');
    assert(adminJs.includes("sb.from('programme_session_participants')"), 'relational participant sync missing');
    assert(adminJs.includes("sb.from('programme_people')"), 'programme_people upsert missing');
  });

  // -------------------------------------------------------------
  // 4. SUPABASE LIVE API VERIFICATION
  // -------------------------------------------------------------
  const urlMatch = supabaseConfigJs.match(/supabaseUrl:\s*['"]([^'"]+)['"]/);
  const anonMatch = supabaseConfigJs.match(/supabaseAnonKey:\s*['"]([^'"]+)['"]/);
  assert(urlMatch && anonMatch, 'Could not parse Supabase URL or Anon key from supabase-config.js');
  const supabaseUrl = urlMatch[1];
  const supabaseAnonKey = anonMatch[1];

  async function fetchSupabase(endpoint, retries = 3) {
    const url = `${supabaseUrl}/rest/v1/${endpoint}`;
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Accept': 'application/json'
          }
        });
        const data = await res.json();
        return { status: res.status, data };
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  await asyncTest('Live DB: Exactly 3 published festival days exist', async () => {
    const res = await fetchSupabase('programme_days?select=*&order=display_order.asc');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.length, 3, `Expected 3 days, got ${res.data.length}`);
    const days = res.data;
    assert.strictEqual(days[0].day_number, 1);
    assert.strictEqual(days[0].date, '2026-10-18');
    assert.strictEqual(days[0].day_name, 'Sunday');

    assert.strictEqual(days[1].day_number, 2);
    assert.strictEqual(days[1].date, '2026-10-19');
    assert.strictEqual(days[1].day_name, 'Monday');

    assert.strictEqual(days[2].day_number, 3);
    assert.strictEqual(days[2].date, '2026-10-20');
    assert.strictEqual(days[2].day_name, 'Tuesday');
  });

  await asyncTest('Live DB: Exactly 13 official sessions exist across 3 days', async () => {
    const res = await fetchSupabase('programme_items?select=*&order=day_number.asc,display_order.asc');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, 13, `Expected 13 sessions, got ${res.data.length}`);
    const items = res.data;

    // Day 1
    const d1 = items.filter(i => i.day_number === 1);
    assert.strictEqual(d1.length, 2, 'Day 1 should have 2 items');
    assert(d1[0].subject.includes('The Prophet ﷺ as Teacher, Legislator, and Source of Knowledge'), 'ﷺ missing in Day 1 inaugural');
    assert.strictEqual(d1[1].title, 'KAVIYARANGU');
    assert.strictEqual(d1[1].participants.length, 0, 'Kaviyarangu should have 0 participants');

    // Day 2
    const d2 = items.filter(i => i.day_number === 2);
    assert.strictEqual(d2.length, 6, 'Day 2 should have 6 items');
    assert(d2[0].subject.includes('Hadith Studies in the Digital Age'));
    assert(d2[1].subject.includes('Why Do Scholars Differ?'));
    assert(d2[2].subject.includes('Contemporary Trends in Global Hadith Research'));
    assert(d2[3].subject.includes('The Indian Subcontinent and Its Contribution'));
    assert.strictEqual(d2[4].title, 'മദ്ഹ് താണ്ടിയ കേരളീയ വഴിയോരങ്ങൾ', 'Malayalam title 1 mismatch');
    assert.strictEqual(d2[4].participants[0].name, 'Ashraf Kondotty');
    assert.strictEqual(d2[4].participants[0].role, 'Led By');
    assert.strictEqual(d2[5].title, 'അഭയം ചൊരിയുന്ന പ്രവാചകൻ', 'Malayalam title 2 mismatch');
    assert.strictEqual(d2[5].participants[0].name, 'Afnan Kidangayam');
    assert.strictEqual(d2[5].participants[0].role, 'Storytelling');

    // Day 3
    const d3 = items.filter(i => i.day_number === 3);
    assert.strictEqual(d3.length, 5, 'Day 3 should have 5 items');
    assert.strictEqual(d3[0].title, 'SESSION 01');
    assert.strictEqual(d3[1].title, 'SESSION 02');
    assert.strictEqual(d3[2].title, 'SESSION 03');
    assert.strictEqual(d3[2].participants.length, 2, 'D3S3 should have 2 panelists');
    assert.strictEqual(d3[3].title, 'HADITH LIVE QUIZ PROGRAMME');
    assert.strictEqual(d3[3].participants.length, 0, 'Quiz should have 0 participants');
    // Day 3 Session 06 MUST remain SESSION 06
    assert.strictEqual(d3[4].session_number, 'SESSION 06', 'Day 3 Session 06 was renamed!');
    assert.strictEqual(d3[4].title, 'MEHFIL-E-ISHQ');
    assert.strictEqual(d3[4].participants.length, 0, 'Mehfil should have 0 participants');
  });

  await asyncTest('Live DB: Relational people & participant records exist', async () => {
    const [pRes, spRes] = await Promise.all([
      fetchSupabase('programme_people?select=*'),
      fetchSupabase('programme_session_participants?select=*')
    ]);
    assert.strictEqual(pRes.status, 200);
    assert.strictEqual(spRes.status, 200);
    assert(pRes.data.length >= 16, `Expected at least 16 people, got ${pRes.data.length}`);
    assert.strictEqual(spRes.data.length, 17, `Expected 17 session participant entries, got ${spRes.data.length}`);

    // Verify role specificity: Dr. Salahuddin Hudawi
    const salahuddin = pRes.data.find(x => x.name === 'Dr. Salahuddin Hudawi');
    assert(salahuddin, 'Dr. Salahuddin Hudawi missing from people');
    const salahuddinRoles = spRes.data.filter(x => x.person_id === salahuddin.id).map(x => x.role);
    assert(salahuddinRoles.includes('Guest'), 'Salahuddin missing Guest role');
    assert(salahuddinRoles.includes('Panelist'), 'Salahuddin missing Panelist role');
  });

  console.log(`\n====================================================`);
  console.log(`RESULTS: ${passedTests} of ${totalTests} tests passed!`);
  console.log(`====================================================`);

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
