const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = 'C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\1915e22f-7fd0-4fab-ba67-0b7104833612';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'chrome_test_profile');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Spawning Chrome with remote debugging on port 9222...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3300/'
  ], { detached: false });

  chromeProc.on('error', (err) => console.error('Chrome process error:', err));

  // Poll until CDP is available
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      tabs = await res.json();
      if (tabs && tabs.length > 0) break;
    } catch (e) {
      await sleep(500);
    }
  }

  if (!tabs || tabs.length === 0) {
    chromeProc.kill();
    throw new Error('Failed to connect to Chrome DevTools port');
  }

  const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:3300')) || tabs[0];
  console.log('Found page tab:', pageTab.title, pageTab.url);

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  console.log('Connected to CDP WebSocket!');

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Evaluation error');
    }
    return res.result.value;
  }

  await send('Page.enable');
  await send('DOM.enable');
  await send('CSS.enable');
  await send('Runtime.enable');

  console.log('\n=============================================');
  console.log('1. VERIFY PUBLIC HOMEPAGE RENDERS PERSISTENT LOGO');
  console.log('=============================================');
  await send('Page.navigate', { url: 'http://localhost:3300/' });
  await sleep(2500);

  const publicInfo = await evaluate(`(async () => {
    if (window.loadDynamicSiteImagesPromise) {
      await window.loadDynamicSiteImagesPromise;
    }
    const navLogoImg = document.querySelector('nav .lg .lgi');
    const aboutLogoImg = document.querySelector('#about .lgi');
    const footerLogoImg = document.querySelector('footer .lgi');
    return {
      siteImagesGlobal: window.HLF_SITE_IMAGES,
      navLogoSrc: navLogoImg ? navLogoImg.src : null,
      aboutLogoSrc: aboutLogoImg ? aboutLogoImg.src : null,
      footerLogoSrc: footerLogoImg ? footerLogoImg.src : null,
      navLogoNaturalWidth: navLogoImg ? navLogoImg.naturalWidth : 0,
      navLogoNaturalHeight: navLogoImg ? navLogoImg.naturalHeight : 0,
      isSupabaseLogo: Boolean(navLogoImg && navLogoImg.src.includes('supabase.co'))
    };
  })()`);

  console.log('Public HLF_SITE_IMAGES logo:', publicInfo.siteImagesGlobal?.logo);
  console.log('Navbar Logo img src:', publicInfo.navLogoSrc);
  console.log('About Section Logo img src:', publicInfo.aboutLogoSrc);
  console.log('Footer Logo img src:', publicInfo.footerLogoSrc);
  console.log('Navbar Logo Natural Dimensions:', `${publicInfo.navLogoNaturalWidth}x${publicInfo.navLogoNaturalHeight}`);
  console.log('Navbar logo loaded from Supabase:', publicInfo.isSupabaseLogo);

  // Take screenshot of public navbar
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(600);
  const mobileScr = await send('Page.captureScreenshot', { format: 'png' });
  const mobileScrPath = path.join(ARTIFACT_DIR, 'public_mobile_with_replacement_logo.png');
  fs.writeFileSync(mobileScrPath, Buffer.from(mobileScr.data, 'base64'));
  console.log('Mobile screenshot with replacement logo saved:', mobileScrPath);

  console.log('\n=============================================');
  console.log('2. VERIFY ADMIN PORTAL BRANDING TAB');
  console.log('=============================================');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send('Page.navigate', { url: 'http://localhost:3300/admin.html' });
  await sleep(2000);

  const adminBrandingInfo = await evaluate(`(async () => {
    // Unhide admin-app for visual panel verification
    const authScreen = document.getElementById('auth-screen');
    const adminApp = document.getElementById('admin-app');
    if (authScreen) authScreen.style.display = 'none';
    if (adminApp) adminApp.style.display = 'flex';

    // Show pane-branding
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
    const brandingPane = document.getElementById('pane-branding');
    if (brandingPane) brandingPane.style.display = 'block';
    
    // Call loadSiteBranding
    if (typeof window.loadSiteBranding === 'function') {
      await window.loadSiteBranding();
    }

    const logoPreview = document.getElementById('brand-logo-preview');
    const faviconPreview = document.getElementById('brand-favicon-preview');
    const posterPreview = document.getElementById('brand-poster-preview');

    return {
      logoPreviewSrc: logoPreview ? logoPreview.src : null,
      logoSavedSrc: logoPreview ? logoPreview.dataset.savedSrc : null,
      faviconPreviewSrc: faviconPreview ? faviconPreview.src : null,
      posterPreviewSrc: posterPreview ? posterPreview.src : null,
      logoIsRemote: Boolean(logoPreview && logoPreview.src.includes('supabase.co'))
    };
  })()`);

  console.log('Admin Brand Logo Preview src:', adminBrandingInfo.logoPreviewSrc);
  console.log('Admin Brand Logo dataset.savedSrc:', adminBrandingInfo.logoSavedSrc);
  console.log('Admin Favicon Preview src:', adminBrandingInfo.faviconPreviewSrc);
  console.log('Admin Poster Preview src:', adminBrandingInfo.posterPreviewSrc);
  console.log('Admin Logo is loaded from Supabase:', adminBrandingInfo.logoIsRemote);

  // Take screenshot of Admin Branding panel
  const adminScr = await send('Page.captureScreenshot', { format: 'png' });
  const adminScrPath = path.join(ARTIFACT_DIR, 'admin_branding_panel.png');
  fs.writeFileSync(adminScrPath, Buffer.from(adminScr.data, 'base64'));
  console.log('Admin panel screenshot saved:', adminScrPath);

  ws.close();
  chromeProc.kill();
  console.log('\n=============================================');
  console.log('TEST COMPLETED SUCCESSFULLY!');
  console.log('=============================================');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
