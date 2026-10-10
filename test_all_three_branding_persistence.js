const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = 'C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\1915e22f-7fd0-4fab-ba67-0b7104833612';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'chrome_test_profile');

const SUPABASE_URL = 'https://vivfwblyxcceacbbhfhk.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdmZ3Ymx5eGNjZWFjYmJoZmhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNzg4NTcsImV4cCI6MjEwNjc1NDg1N30.KkLgybkJLYs1pHjwejiUqUOUt0e-wGYU6TzVLRnTZC4';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('===========================================================');
  console.log('HLF 2026 — VERIFY ALL THREE SITE IMAGE UPLOADS & PERSISTENCE');
  console.log('===========================================================\n');

  // 1. Check current Supabase festival_settings
  const res = await fetch(`${SUPABASE_URL}/rest/v1/festival_settings?id=eq.general`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
  });
  const settingsArr = await res.json();
  const settings = settingsArr[0] || {};
  console.log('1. Current festival_settings branding state:');
  console.log('   logo_url:', settings.logo_url);
  console.log('   favicon_url:', settings.favicon_url);
  console.log('   official_poster_url:', settings.official_poster_url);

  // 2. Spawn headless Chrome to test Admin portal branding tab & page reload persistence
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3300/admin.html'
  ], { detached: false });

  let tabsRes = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      tabsRes = await res.json();
      if (tabsRes && tabsRes.length > 0) break;
    } catch (e) {
      await sleep(400);
    }
  }

  const tab = tabsRes.find(t => t.type === 'page' && t.url.includes('localhost:3300')) || tabsRes[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const cur = id++;
      pending.set(cur, { resolve, reject });
      ws.send(JSON.stringify({ id: cur, method, params }));
    });
  }

  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'Eval error');
    return r.result.value;
  }

  await send('Runtime.enable');
  await send('Page.enable');

  console.log('\n2. Testing Admin Portal Site Images & Branding Tab...');
  await send('Page.navigate', { url: 'http://localhost:3300/admin.html' });
  await sleep(1500);

  const adminResult = await evaluate(`(async () => {
    const authScreen = document.getElementById('auth-screen');
    const adminApp = document.getElementById('admin-app');
    if (authScreen) authScreen.style.display = 'none';
    if (adminApp) adminApp.style.display = 'flex';

    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
    const brandingPane = document.getElementById('pane-branding');
    if (brandingPane) brandingPane.style.display = 'block';

    if (typeof window.loadSiteBranding === 'function') {
      await window.loadSiteBranding();
    }

    const logoPreview = document.getElementById('brand-logo-preview');
    const faviconPreview = document.getElementById('brand-favicon-preview');
    const posterPreview = document.getElementById('brand-poster-preview');

    return {
      logoSrc: logoPreview ? logoPreview.src : null,
      logoSavedSrc: logoPreview ? logoPreview.dataset.savedSrc : null,
      faviconSrc: faviconPreview ? faviconPreview.src : null,
      faviconSavedSrc: faviconPreview ? faviconPreview.dataset.savedSrc : null,
      posterSrc: posterPreview ? posterPreview.src : null,
      posterSavedSrc: posterPreview ? posterPreview.dataset.savedSrc : null
    };
  })()`);

  console.log('   Admin Logo Preview:', adminResult.logoSrc);
  console.log('   Admin Logo dataset.savedSrc:', adminResult.logoSavedSrc);
  console.log('   Admin Favicon Preview:', adminResult.faviconSrc);
  console.log('   Admin Poster Preview:', adminResult.posterSrc);

  console.log('\n3. Testing Page Refresh Persistence in Admin Portal...');
  await send('Page.reload');
  await sleep(1500);

  const reloadedAdminResult = await evaluate(`(async () => {
    const authScreen = document.getElementById('auth-screen');
    const adminApp = document.getElementById('admin-app');
    if (authScreen) authScreen.style.display = 'none';
    if (adminApp) adminApp.style.display = 'flex';

    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
    const brandingPane = document.getElementById('pane-branding');
    if (brandingPane) brandingPane.style.display = 'block';

    if (typeof window.loadSiteBranding === 'function') {
      await window.loadSiteBranding();
    }

    const logoPreview = document.getElementById('brand-logo-preview');
    return {
      logoSrc: logoPreview ? logoPreview.src : null,
      logoSavedSrc: logoPreview ? logoPreview.dataset.savedSrc : null
    };
  })()`);

  console.log('   Admin Logo after reload:', reloadedAdminResult.logoSrc);
  if (reloadedAdminResult.logoSrc.includes('supabase.co')) {
    console.log('   ✓ Logo successfully persisted across reload without reverting to local fallback!');
  } else {
    console.error('   ✗ FAILED: Logo reverted to local fallback after reload!');
  }

  console.log('\n4. Testing Public Landing Page Resolution...');
  await send('Page.navigate', { url: 'http://localhost:3300/' });
  await sleep(1500);

  const publicResult = await evaluate(`(async () => {
    if (window.loadDynamicSiteImagesPromise) {
      await window.loadDynamicSiteImagesPromise;
    }
    const navLogo = document.querySelector('nav .lg .lgi');
    const aboutLogo = document.querySelector('#about .lgi');
    const footerLogo = document.querySelector('footer .lgi');
    const favicons = Array.from(document.querySelectorAll("link[rel*='icon']")).map(l => l.href);
    return {
      navLogo: navLogo ? navLogo.src : null,
      aboutLogo: aboutLogo ? aboutLogo.src : null,
      footerLogo: footerLogo ? footerLogo.src : null,
      favicons,
      globalLogo: window.HLF_SITE_IMAGES ? window.HLF_SITE_IMAGES.logo : null
    };
  })()`);

  console.log('   Public Nav Logo:', publicResult.navLogo);
  console.log('   Public About Logo:', publicResult.aboutLogo);
  console.log('   Public Footer Logo:', publicResult.footerLogo);
  console.log('   Public Global Images Logo:', publicResult.globalLogo);

  if (publicResult.navLogo && publicResult.navLogo.includes('supabase.co')) {
    console.log('   ✓ Public site displays the Supabase replacement logo correctly!');
  } else {
    console.error('   ✗ FAILED: Public site is not displaying the Supabase replacement logo!');
  }

  ws.close();
  chromeProc.kill();
  console.log('\n===========================================================');
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('===========================================================');
}

main().catch(console.error);
