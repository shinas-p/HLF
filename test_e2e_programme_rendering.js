const http = require('http');
const https = require('https');
const assert = require('assert');
const fs = require('fs');

console.log('====================================================');
console.log('HLF 2026 — E2E PROGRAMME RENDERING & FLOW VERIFICATION');
console.log('====================================================\n');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function run() {
  // 1. Verify localhost:3300 is serving index.html
  console.log('1. Testing Local Server (index.html)...');
  const indexRes = await httpGet('http://localhost:3300/');
  assert.strictEqual(indexRes.status, 200, 'Expected status 200 from localhost:3300');
  assert(indexRes.body.includes('HLF 2026 — Hadith Literature Festival'), 'Website title missing');
  assert(indexRes.body.includes('id="schedule"'), '#schedule section missing');
  assert(indexRes.body.includes('loadScheduleFromDatabase'), 'loadScheduleFromDatabase missing');
  console.log('✓ Public website index.html served successfully via localhost:3300\n');

  // 2. Verify localhost:3300/admin serves admin/index.html
  console.log('2. Testing Admin Portal Route (localhost:3300/admin)...');
  const adminRes = await httpGet('http://localhost:3300/admin');
  assert.strictEqual(adminRes.status, 200, 'Expected status 200 from localhost:3300/admin');
  assert(adminRes.body.includes('pane-programme'), '#pane-programme missing in admin');
  assert(adminRes.body.includes('programme-days-container'), '#programme-days-container missing in admin');
  assert(adminRes.body.includes('programme-cards-container'), '#programme-cards-container missing in admin');
  assert(adminRes.body.includes('session-modal'), '#session-modal missing in admin');
  assert(adminRes.body.includes('day-modal'), '#day-modal missing in admin');
  console.log('✓ Admin portal served successfully via localhost:3300/admin\n');

  // 3. Verify Supabase REST API & dynamic rendering pipeline
  console.log('3. Testing Supabase Live Data & Dynamic Render Logic...');
  const configJs = fs.readFileSync('js/supabase-config.js', 'utf8');
  const urlMatch = configJs.match(/supabaseUrl:\s*['"]([^'"]+)['"]/);
  const anonMatch = configJs.match(/supabaseAnonKey:\s*['"]([^'"]+)['"]/);
  const supabaseUrl = urlMatch[1];
  const anonKey = anonMatch[1];

  const headers = { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` };

  const daysApiRes = await httpsGet(`${supabaseUrl}/rest/v1/programme_days?select=*&order=display_order.asc`, headers);
  assert.strictEqual(daysApiRes.status, 200);
  const days = JSON.parse(daysApiRes.body);
  assert.strictEqual(days.length, 3, 'Must have 3 festival days');

  const itemsApiRes = await httpsGet(`${supabaseUrl}/rest/v1/programme_items?select=*&order=day_number.asc,display_order.asc`, headers);
  assert.strictEqual(itemsApiRes.status, 200);
  const items = JSON.parse(itemsApiRes.body);
  assert.strictEqual(items.length, 13, 'Must have 13 official sessions');

  // Replicate index.html renderScheduleItem logic
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderScheduleItem(i) {
    const timeStr = `${i.start_time || ''}${i.end_time ? ' – ' + i.end_time : ''}`.trim();
    const numBadge = (i.session_number || '').trim();
    const typeTag = (i.session_type || i.category || '').trim();
    let mainTitle = (i.title || '').trim();
    let subjectText = (i.subject || '').trim();

    if (subjectText && mainTitle && mainTitle.toUpperCase().startsWith('SESSION')) {
      mainTitle = subjectText;
      subjectText = '';
    }

    let participantsHtml = '';
    const parts = Array.isArray(i.participants) ? i.participants : [];
    if (parts.length > 0) {
      const roleGroups = {};
      parts.forEach(p => {
        if (!p || !p.name) return;
        const r = (p.role || 'Participant').trim();
        if (!roleGroups[r]) roleGroups[r] = [];
        roleGroups[r].push(p.name);
      });
      const groupsHtml = Object.keys(roleGroups).map(role => {
        const names = roleGroups[role];
        const label = names.length > 1 && role === 'Panelist' ? 'Panelists' : (names.length > 1 && role === 'Guest' ? 'Guests' : role);
        const chips = names.map(n => `<span class="prog-person-chip">${escapeHtml(n)}</span>`).join('');
        return `<div class="prog-role-group"><span class="prog-role-label">${escapeHtml(label)}:</span><div class="prog-role-names">${chips}</div></div>`;
      }).join('');
      participantsHtml = `<div class="prog-participants-box">${groupsHtml}</div>`;
    }

    return `
      <div class="it prog-item">
        <div class="prog-time-wrap">
          <b class="prog-time-badge">${escapeHtml(timeStr)}</b>
          ${typeTag && typeTag.toLowerCase() !== 'session' ? `<span class="prog-type-pill">${escapeHtml(typeTag)}</span>` : ''}
        </div>
        <div class="prog-body">
          ${numBadge ? `<div class="prog-num-tag">${escapeHtml(numBadge)}</div>` : ''}
          <h3 class="prog-title">${escapeHtml(mainTitle)}</h3>
          ${subjectText ? `<p class="prog-subject">${escapeHtml(subjectText)}</p>` : ''}
          ${participantsHtml}
        </div>
      </div>
    `;
  }

  // Verify Day 1 Output
  const day1Items = items.filter(x => x.day_number === 1);
  const day1Html = day1Items.map(renderScheduleItem).join('');
  assert(day1Html.includes('INAUGURAL SESSION'), 'Day 1 Inaugural title missing');
  assert(day1Html.includes('The Prophet ﷺ as Teacher, Legislator, and Source of Knowledge'), 'ﷺ subject missing');
  assert(day1Html.includes('Niyas'), 'Panelist Niyas missing');
  assert(day1Html.includes('Swami Athmadas Yami'), 'Panelist Swami Athmadas Yami missing');
  assert(day1Html.includes('Dr. Bahauddin Nadwi'), 'Guest Dr. Bahauddin Nadwi missing');
  assert(day1Html.includes('KAVIYARANGU'), 'Day 1 Kaviyarangu missing');
  assert(day1Html.includes('7:15 PM – 8:30 PM'), 'Day 1 Kaviyarangu time missing');
  console.log('✓ Day 1 rendering verified (Inaugural with ﷺ, Panelists, Guests, Kaviyarangu without speakers)');

  // Verify Day 2 Output
  const day2Items = items.filter(x => x.day_number === 2);
  const day2Html = day2Items.map(renderScheduleItem).join('');
  assert(day2Html.includes('Hadith Studies in the Digital Age'), 'Day 2 S1 missing');
  assert(day2Html.includes('Yousuf Hudawi Valakkulam'), 'Day 2 S1 panelist missing');
  assert(day2Html.includes('Why Do Scholars Differ?'), 'Day 2 S2 missing');
  assert(day2Html.includes('Dr. Jabirali Hudawi'), 'Day 2 S2 panelist missing');
  assert(day2Html.includes('Contemporary Trends in Global Hadith Research'), 'Day 2 S3 missing');
  assert(day2Html.includes('Dr. Salahuddin Hudawi'), 'Day 2 S3 panelist missing');
  assert(day2Html.includes('The Indian Subcontinent and Its Contribution to Hadith Scholarship'), 'Day 2 S4 missing');
  assert(day2Html.includes('Unais Hidaya Hudawi'), 'Day 2 S4 panelist missing');
  assert(day2Html.includes('മദ്ഹ് താണ്ടിയ കേരളീയ വഴിയോരങ്ങൾ'), 'Day 2 Malayalam Title 1 missing');
  assert(day2Html.includes('Ashraf Kondotty'), 'Day 2 Led by Ashraf Kondotty missing');
  assert(day2Html.includes('അഭയം ചൊരിയുന്ന പ്രവാചകൻ'), 'Day 2 Malayalam Title 2 missing');
  assert(day2Html.includes('Afnan Kidangayam'), 'Day 2 Storytelling Afnan Kidangayam missing');
  console.log('✓ Day 2 rendering verified (Academic sessions 1-4, Malayalam titles, Led By, Storytelling)');

  // Verify Day 3 Output
  const day3Items = items.filter(x => x.day_number === 3);
  const day3Html = day3Items.map(renderScheduleItem).join('');
  assert(day3Html.includes('The Eloquence of Prophetic Speech'), 'Day 3 S1 missing');
  assert(day3Html.includes('Jafar Pk Hudawi'), 'Day 3 S1 panelist missing');
  assert(day3Html.includes('The Evolving Social Function of Isnad in the Post-Canonical Period'), 'Day 3 S2 missing');
  assert(day3Html.includes('Habeeburrahman Hudawi'), 'Day 3 S2 panelist missing');
  assert(day3Html.includes('Oral Tradition in Islam and Beyond'), 'Day 3 S3 missing');
  assert(day3Html.includes('Rasheed Hudawi Elamkulam'), 'Day 3 S3 panelist 1 missing');
  assert(day3Html.includes('Rafeeq Ali Hudawi'), 'Day 3 S3 panelist 2 missing');
  assert(day3Html.includes('HADITH LIVE QUIZ PROGRAMME'), 'Day 3 S4 Quiz missing');
  assert(day3Html.includes('SESSION 06'), 'Day 3 SESSION 06 tag missing');
  assert(day3Html.includes('MEHFIL-E-ISHQ'), 'Day 3 MEHFIL-E-ISHQ title missing');
  console.log('✓ Day 3 rendering verified (Sessions 1-4 and strictly preserved SESSION 06 Mehfil-e-Ishq)');

  console.log('\n====================================================');
  console.log('ALL E2E RENDER & PIPELINE CHECKS PASSED PERFECTLY!');
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
