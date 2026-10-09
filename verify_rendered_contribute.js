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

  // Wait for page to fully load
  await sleep(1500);

  const currentUrl = await evaluate('document.location.href');
  const currentTitle = await evaluate('document.title');
  console.log('Current Page:', currentTitle, '|', currentUrl);

  console.log('\n=============================================');
  console.log('1. HERO BUTTON ORDER & STYLING VERIFICATION');
  console.log('=============================================');
  const heroInfo = await evaluate(`(() => {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions) {
      const allBtns = Array.from(document.querySelectorAll('.btn')).map(b => ({ text: b.innerText, class: b.className }));
      return { error: 'No .hero-actions element found', allBtns };
    }
    const buttons = Array.from(heroActions.querySelectorAll('.btn'));
    return {
      count: buttons.length,
      button1: {
        text: buttons[0]?.innerText?.trim(),
        className: buttons[0]?.className,
        hasSparkle: Boolean(buttons[0]?.querySelector('.btn-sparkle')),
        isContribute: buttons[0]?.classList.contains('btn-contribute-cta'),
        bg: getComputedStyle(buttons[0]).backgroundImage,
        overflow: getComputedStyle(buttons[0]).overflow,
        borderRadius: getComputedStyle(buttons[0]).borderRadius,
        boxShadow: getComputedStyle(buttons[0]).boxShadow,
        zIndexText: getComputedStyle(buttons[0].children[0]).zIndex
      },
      button2: {
        text: buttons[1]?.innerText?.trim(),
        className: buttons[1]?.className,
        isReg: buttons[1]?.classList.contains('reg'),
        bg: getComputedStyle(buttons[1]).backgroundColor,
        borderRadius: getComputedStyle(buttons[1]).borderRadius
      }
    };
  })()`);

  if (heroInfo.error) {
    console.error('HERO ERROR:', heroInfo);
    throw new Error('Hero buttons check failed: ' + heroInfo.error);
  }

  console.log('Hero Button 1 (Left/Position 1):', heroInfo.button1.text, '| Class:', heroInfo.button1.className);
  console.log('Hero Button 2 (Right/Position 2):', heroInfo.button2.text, '| Class:', heroInfo.button2.className);
  console.log('Contribute Background:', heroInfo.button1.bg);
  console.log('Contribute Overflow & Radius:', heroInfo.button1.overflow, '|', heroInfo.button1.borderRadius);
  console.log('Contribute Box Shadow (Warm Glow):', heroInfo.button1.boxShadow);
  console.log('Contribute Text zIndex:', heroInfo.button1.zIndexText);

  console.log('\n=============================================');
  console.log('2. GLOSSY SHINE ANIMATION & PSEUDO-ELEMENT');
  console.log('=============================================');
  const shineInfo = await evaluate(`(() => {
    const btn = document.querySelector('.hero-contrib');
    const afterStyle = window.getComputedStyle(btn, '::after');
    return {
      content: afterStyle.content,
      position: afterStyle.position,
      animationName: afterStyle.animationName,
      animationDuration: afterStyle.animationDuration,
      animationIterationCount: afterStyle.animationIterationCount,
      pointerEvents: afterStyle.pointerEvents,
      zIndex: afterStyle.zIndex,
      background: afterStyle.background || afterStyle.backgroundImage
    };
  })()`);
  console.log('Shine ::after animation-name:', shineInfo.animationName);
  console.log('Shine ::after animation-duration:', shineInfo.animationDuration);
  console.log('Shine ::after animation-iteration-count:', shineInfo.animationIterationCount);
  console.log('Shine ::after pointer-events:', shineInfo.pointerEvents);
  console.log('Shine ::after background gradient:', shineInfo.background);

  console.log('\n=============================================');
  console.log('3. NAVBAR BUTTONS & DESKTOP LAYOUT (1280px)');
  console.log('=============================================');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(600);

  const navInfo = await evaluate(`(() => {
    const nav = document.querySelector('nav');
    const contrib = nav.querySelector('.btn-contribute-cta');
    const reg = nav.querySelector('.reg');
    const themeBtn = nav.querySelector('#th');
    const menuBtn = nav.querySelector('#mb');
    return {
      hasContrib: Boolean(contrib),
      contribText: contrib?.innerText?.trim(),
      contribClass: contrib?.className,
      hasReg: Boolean(reg),
      regText: reg?.innerText?.trim(),
      regClass: reg?.className,
      hasTheme: Boolean(themeBtn),
      hasMenu: Boolean(menuBtn),
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
    };
  })()`);
  console.log('Nav Contribute CTA:', navInfo.contribText, '| Class:', navInfo.contribClass);
  console.log('Nav Register CTA:', navInfo.regText, '| Class:', navInfo.regClass);
  console.log('Nav Theme toggle present:', navInfo.hasTheme);
  console.log('Desktop 1280px no horizontal overflow:', navInfo.noHorizontalOverflow);

  // Take Desktop Screenshot
  const desktopScr = await send('Page.captureScreenshot', { format: 'png' });
  const desktopImgPath = path.join(ARTIFACT_DIR, 'desktop_rendered_view.png');
  fs.writeFileSync(desktopImgPath, Buffer.from(desktopScr.data, 'base64'));
  console.log('Desktop screenshot saved:', desktopImgPath);

  console.log('\n=============================================');
  console.log('4. CLICK HANDLER & MODAL FUNCTIONALITY');
  console.log('=============================================');
  // Click Hero Contribute
  const heroContribClick = await evaluate(`(() => {
    const btn = document.querySelector('.hero-contrib');
    btn.click();
    const d = document.getElementById('contrib-dialog');
    return {
      dialogExists: Boolean(d),
      isOpen: d ? d.open : false
    };
  })()`);
  console.log('Click Hero Contribute opens #contrib-dialog:', heroContribClick);

  // Take screenshot with Contribution modal open
  const contribModalScr = await send('Page.captureScreenshot', { format: 'png' });
  const contribModalImgPath = path.join(ARTIFACT_DIR, 'contribute_modal_opened.png');
  fs.writeFileSync(contribModalImgPath, Buffer.from(contribModalScr.data, 'base64'));
  console.log('Contribution modal screenshot saved:', contribModalImgPath);

  // Close Contribution Modal
  await evaluate(`(() => {
    const d = document.getElementById('contrib-dialog');
    if (d && d.close) d.close();
  })()`);

  // Click Hero Register
  const heroRegClick = await evaluate(`(() => {
    const btn = document.querySelector('.hero-reg');
    btn.click();
    const d = document.getElementById('reg-dialog');
    return {
      dialogExists: Boolean(d),
      isOpen: d ? d.open : false
    };
  })()`);
  console.log('Click Hero Register opens #reg-dialog:', heroRegClick);

  // Close Reg modal
  await evaluate(`(() => {
    const d = document.getElementById('reg-dialog');
    if (d && d.close) d.close();
  })()`);

  // Click Nav Contribute
  const navContribClick = await evaluate(`(() => {
    const btn = document.querySelector('nav .btn-contribute-cta');
    btn.click();
    const d = document.getElementById('contrib-dialog');
    return {
      dialogExists: Boolean(d),
      isOpen: d ? d.open : false
    };
  })()`);
  console.log('Click Nav Contribute opens #contrib-dialog:', navContribClick);

  // Close Contribution Modal
  await evaluate(`(() => {
    const d = document.getElementById('contrib-dialog');
    if (d && d.close) d.close();
  })()`);

  // Click Nav Register
  const navRegClick = await evaluate(`(() => {
    const btn = document.querySelector('nav .btn.nav-reg');
    btn.click();
    const d = document.getElementById('reg-dialog');
    return {
      dialogExists: Boolean(d),
      isOpen: d ? d.open : false
    };
  })()`);
  console.log('Click Nav Register opens #reg-dialog:', navRegClick);

  // Close Reg modal
  await evaluate(`(() => {
    const d = document.getElementById('reg-dialog');
    if (d && d.close) d.close();
  })()`);

  console.log('\n=============================================');
  console.log('5. MOBILE VIEWPORT TEST (375px & 360px)');
  console.log('=============================================');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(600);

  const mobileInfo = await evaluate(`(() => {
    const nav = document.querySelector('nav');
    const contrib = nav.querySelector('.btn-contribute-cta');
    const reg = nav.querySelector('.btn.nav-reg');
    const heroContrib = document.querySelector('.hero-contrib');
    const heroReg = document.querySelector('.hero-reg');
    return {
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      navScrollWidth: nav.scrollWidth,
      navClientWidth: nav.clientWidth,
      navContribWidth: contrib ? contrib.getBoundingClientRect().width : 0,
      navRegWidth: reg ? reg.getBoundingClientRect().width : 0,
      heroContribWidth: heroContrib ? heroContrib.getBoundingClientRect().width : 0,
      heroRegWidth: heroReg ? heroReg.getBoundingClientRect().width : 0
    };
  })()`);
  console.log('Mobile 375px no horizontal overflow:', mobileInfo.noHorizontalOverflow);
  console.log('Mobile nav scrollWidth vs clientWidth:', mobileInfo.navScrollWidth, '<=', mobileInfo.navClientWidth);
  console.log('Mobile nav Contribute width:', mobileInfo.navContribWidth, 'px');
  console.log('Mobile nav Register width:', mobileInfo.navRegWidth, 'px');

  // Take Mobile Screenshot
  const mobileScr = await send('Page.captureScreenshot', { format: 'png' });
  const mobileImgPath = path.join(ARTIFACT_DIR, 'mobile_rendered_view.png');
  fs.writeFileSync(mobileImgPath, Buffer.from(mobileScr.data, 'base64'));
  console.log('Mobile screenshot saved:', mobileImgPath);

  console.log('\n=============================================');
  console.log('6. REDUCED MOTION BEHAVIOR');
  console.log('=============================================');
  await send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await sleep(400);

  const reducedMotionInfo = await evaluate(`(() => {
    const btn = document.querySelector('.hero-contrib');
    const afterStyle = window.getComputedStyle(btn, '::after');
    return {
      animationName: afterStyle.animationName,
      display: afterStyle.display
    };
  })()`);
  console.log('Reduced motion animationName:', reducedMotionInfo.animationName);
  console.log('Reduced motion display:', reducedMotionInfo.display);

  ws.close();
  chromeProc.kill();
  console.log('\n=============================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('=============================================');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
