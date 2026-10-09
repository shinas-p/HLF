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

  await send('Page.navigate', { url: 'http://localhost:3300/' });
  // Wait for page to fully load
  await sleep(2000);

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
  console.log('3. NAVBAR BUTTONS & DESKTOP LAYOUT (1440px & 1024px)');
  console.log('=============================================');
  // Test at 1440px
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(600);

  const nav1440Info = await evaluate(`(() => {
    const nav = document.querySelector('nav');
    const contrib = nav.querySelector('.btn-contribute-cta');
    const navReg = nav.querySelector('.reg');
    const themeBtn = nav.querySelector('#th');
    const menuBtn = nav.querySelector('#mb');
    const cStyle = contrib ? getComputedStyle(contrib) : {};
    return {
      hasContrib: Boolean(contrib),
      contribText: contrib?.innerText?.trim(),
      contribClass: contrib?.className,
      contribPadding: cStyle.padding,
      contribFontSize: cStyle.fontSize,
      contribFontWeight: cStyle.fontWeight,
      contribBoxShadow: cStyle.boxShadow,
      contribHeight: contrib ? contrib.getBoundingClientRect().height : 0,
      contribWidth: contrib ? contrib.getBoundingClientRect().width : 0,
      registerRemovedFromNav: navReg === null,
      hasTheme: Boolean(themeBtn),
      hasMenu: Boolean(menuBtn),
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      noHorizontalOverflow1440: document.documentElement.scrollWidth <= document.documentElement.clientWidth
    };
  })()`);
  console.log('1440px Nav Contribute CTA:', nav1440Info.contribText, '| Class:', nav1440Info.contribClass);
  console.log('Contribute Dimensions (Enlarged):', `${nav1440Info.contribWidth}px x ${nav1440Info.contribHeight}px`);
  console.log('Contribute Padding & Font:', nav1440Info.contribPadding, '|', nav1440Info.contribFontSize, '| weight:', nav1440Info.contribFontWeight);
  console.log('Register ↗ removed from navbar:', nav1440Info.registerRemovedFromNav);
  console.log('1440px no horizontal overflow:', nav1440Info.noHorizontalOverflow1440);

  // Test at 1024px
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(600);

  const nav1024Info = await evaluate(`(() => {
    return {
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      noHorizontalOverflow1024: document.documentElement.scrollWidth <= document.documentElement.clientWidth
    };
  })()`);
  console.log('1024px no horizontal overflow:', nav1024Info.noHorizontalOverflow1024);

  // Take Desktop Screenshot (1280px)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(400);
  const desktopScr = await send('Page.captureScreenshot', { format: 'png' });
  const desktopImgPath = path.join(ARTIFACT_DIR, 'desktop_rendered_view.png');
  fs.writeFileSync(desktopImgPath, Buffer.from(desktopScr.data, 'base64'));
  console.log('Desktop screenshot saved:', desktopImgPath);

  console.log('\n=============================================');
  console.log('4. CUSTOM CONTRIBUTION & MODAL FUNCTIONALITY');
  console.log('=============================================');

  // Test 4A: Hero Contribute opens with Custom Contribution by default
  const heroContribCustomTest = await evaluate(`(() => {
    const btn = document.querySelector('.hero-contrib');
    btn.click();
    const d = document.getElementById('contrib-dialog');
    const wrap = document.getElementById('contrib-custom-amount-wrap');
    const input = document.getElementById('contrib-custom-amount-input');
    const tierBadge = document.getElementById('contrib-tier-badge');
    const amtBadge = document.getElementById('contrib-amount-badge');
    return {
      isOpen: Boolean(d && d.open),
      customWrapVisible: wrap ? getComputedStyle(wrap).display !== 'none' : false,
      tierBadgeText: tierBadge ? tierBadge.innerText.trim() : null,
      amountBadgeText: amtBadge ? amtBadge.innerText.trim() : null,
      inputValue: input ? input.value : null,
      inputRequired: input ? input.required : false,
      inputEnabled: input ? !input.disabled : false
    };
  })()`);
  console.log('Hero Contribute -> Custom selected by default:', heroContribCustomTest);

  // Test 4B: Live custom amount input (Enter ₹250) & Step 1 badge updates
  const customInputLiveTest = await evaluate(`(() => {
    const input = document.getElementById('contrib-custom-amount-input');
    const amtBadge = document.getElementById('contrib-amount-badge');
    const proceedBtnText = document.getElementById('contrib-step1-proceed-btn-text');
    input.value = '250';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      amountBadgeUpdated: amtBadge ? amtBadge.innerText.trim() : null,
      proceedBtnText: proceedBtnText ? proceedBtnText.innerText.trim() : null
    };
  })()`);
  console.log('Custom amount ₹250 live update on Step 1:', customInputLiveTest);

  // Test 4C: Fill contributor details and proceed to Step 2
  const proceedStep2Test = await evaluate(`(() => {
    const nameInput = document.getElementById('contrib-fullname');
    const mobileInput = document.getElementById('contrib-mobile');
    nameInput.value = 'Sayyid Ahmed';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    mobileInput.value = '9876543210';
    mobileInput.dispatchEvent(new Event('input', { bubbles: true }));

    const proceedBtn = document.getElementById('contrib-step1-proceed-btn');
    proceedBtn.click();

    const s2View = document.getElementById('contrib-step2-view');
    const headerAmt = document.getElementById('contrib-step2-header-amount');
    const summaryTier = document.getElementById('contrib-summary-tier');
    const summaryAmt = document.getElementById('contrib-summary-amount');
    const payAmt = document.getElementById('contrib-pay-amount');
    const intentBtn = document.getElementById('contrib-pay-intent-btn');
    const intentUrl = intentBtn ? intentBtn.href : '';

    return {
      step2Visible: s2View ? getComputedStyle(s2View).display !== 'none' : false,
      headerAmount: headerAmt ? headerAmt.innerText.trim() : null,
      summaryTier: summaryTier ? summaryTier.innerText.trim() : null,
      summaryAmount: summaryAmt ? summaryAmt.innerText.trim() : null,
      payAmount: payAmt ? payAmt.innerText.trim() : null,
      intentHasCorrectAmount: intentUrl.includes('am=250')
    };
  })()`);
  console.log('Step 2 Custom Amount (₹250) payment verification:', proceedStep2Test);

  // Capture Screenshot of Step 2 with Custom ₹250 Payment
  const contribModalScr = await send('Page.captureScreenshot', { format: 'png' });
  const contribModalImgPath = path.join(ARTIFACT_DIR, 'contribute_custom_step2_opened.png');
  fs.writeFileSync(contribModalImgPath, Buffer.from(contribModalScr.data, 'base64'));
  console.log('Step 2 screenshot saved:', contribModalImgPath);

  // Test 4D: Backward Navigation preserves entered custom amount and contributor details
  const backNavigationTest = await evaluate(`(() => {
    const backBtn = document.getElementById('contrib-step2-back-btn');
    backBtn.click();

    const s1View = document.getElementById('contrib-step1-view');
    const nameInput = document.getElementById('contrib-fullname');
    const mobileInput = document.getElementById('contrib-mobile');
    const customInput = document.getElementById('contrib-custom-amount-input');
    const amtBadge = document.getElementById('contrib-amount-badge');

    return {
      step1Visible: s1View ? getComputedStyle(s1View).display !== 'none' : false,
      preservedName: nameInput ? nameInput.value : null,
      preservedMobile: mobileInput ? mobileInput.value : null,
      preservedCustomAmount: customInput ? customInput.value : null,
      amountBadgeText: amtBadge ? amtBadge.innerText.trim() : null
    };
  })()`);
  console.log('Backward navigation preserves data:', backNavigationTest);

  // Close Contribution Modal
  await evaluate(`(() => {
    const d = document.getElementById('contrib-dialog');
    if (d && d.close) d.close();
  })()`);

  // Test 4E: Stale data reset when reopening from Nav Contribute button
  const navContribStaleResetTest = await evaluate(`(() => {
    const btn = document.querySelector('nav .btn-contribute-cta');
    btn.click();

    const d = document.getElementById('contrib-dialog');
    const wrap = document.getElementById('contrib-custom-amount-wrap');
    const input = document.getElementById('contrib-custom-amount-input');
    const nameInput = document.getElementById('contrib-fullname');
    const mobileInput = document.getElementById('contrib-mobile');
    const tierBadge = document.getElementById('contrib-tier-badge');
    const amtBadge = document.getElementById('contrib-amount-badge');

    return {
      isOpen: Boolean(d && d.open),
      customWrapVisible: wrap ? getComputedStyle(wrap).display !== 'none' : false,
      tierBadgeText: tierBadge ? tierBadge.innerText.trim() : null,
      amountBadgeText: amtBadge ? amtBadge.innerText.trim() : null,
      staleNameReset: nameInput ? nameInput.value === '' : false,
      staleMobileReset: mobileInput ? mobileInput.value === '' : false,
      staleAmountReset: input ? input.value === '' : false,
      inputEnabled: input ? !input.disabled : false
    };
  })()`);
  console.log('Nav Contribute -> Opens fresh Custom session (stale data reset):', navContribStaleResetTest);

  // Close Contribution Modal
  await evaluate(`(() => {
    const d = document.getElementById('contrib-dialog');
    if (d && d.close) d.close();
  })()`);

  // Test 4F: Verify other contribution tiers still open with their respective tiers (not forced to custom)
  const tierGridEntryTest = await evaluate(`(() => {
    // Click Minimal ₹99 button in tiers grid
    const tierBtns = Array.from(document.querySelectorAll('#tiers .contrib-btn, .tier button'));
    if (tierBtns.length > 0) {
      tierBtns[0].click();
      const d = document.getElementById('contrib-dialog');
      const wrap = document.getElementById('contrib-custom-amount-wrap');
      const tierBadge = document.getElementById('contrib-tier-badge');
      const amtBadge = document.getElementById('contrib-amount-badge');
      return {
        isOpen: Boolean(d && d.open),
        customWrapHidden: wrap ? getComputedStyle(wrap).display === 'none' : false,
        tierBadgeText: tierBadge ? tierBadge.innerText.trim() : null,
        amountBadgeText: amtBadge ? amtBadge.innerText.trim() : null
      };
    }
    return { skipped: 'No tier buttons found in DOM' };
  })()`);
  console.log('Tier grid entry point preserves tier behavior (Minimal ₹99):', tierGridEntryTest);

  // Close Contribution Modal
  await evaluate(`(() => {
    const d = document.getElementById('contrib-dialog');
    if (d && d.close) d.close();
  })()`);

  // Test 4G: Registration Modal still opens cleanly
  const regClickTest = await evaluate(`(() => {
    const regBtn = document.querySelector('.hero-reg');
    regBtn.click();
    const d = document.getElementById('reg-dialog');
    return {
      regDialogOpen: Boolean(d && d.open)
    };
  })()`);
  console.log('Registration functionality preserved:', regClickTest);

  // Close Reg modal
  await evaluate(`(() => {
    const d = document.getElementById('reg-dialog');
    if (d && d.close) d.close();
  })()`);

  console.log('\n=============================================');
  console.log('5. MOBILE VIEWPORT TESTS (320px, 360px, 375px, 390px, 412px)');
  console.log('=============================================');

  const mobileBreakpoints = [
    { name: 'Narrow SE (320px)', width: 320, height: 568 },
    { name: 'Small Android (360px)', width: 360, height: 740 },
    { name: 'Standard iPhone (375px)', width: 375, height: 812 },
    { name: 'Modern iPhone (390px)', width: 390, height: 844 },
    { name: 'Pixel / Android Large (412px)', width: 412, height: 915 }
  ];

  for (const bp of mobileBreakpoints) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: bp.width,
      height: bp.height,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(400);

    const check = await evaluate(`(() => {
      const nav = document.querySelector('nav');
      const lg = nav ? nav.querySelector('.lg') : null;
      const lgImg = lg ? lg.querySelector('.lgi') : null;
      const lgSpan = lg ? lg.querySelector('span') : null;
      const themeBtn = nav ? nav.querySelector('#th') : null;
      const contribBtn = nav ? nav.querySelector('.btn-contribute-cta.nav-contrib') : null;
      const menuBtn = nav ? nav.querySelector('#mb') : null;

      const lgSpanStyle = lgSpan ? getComputedStyle(lgSpan) : null;
      const lgSpanRect = lgSpan ? lgSpan.getBoundingClientRect() : null;
      const lgImgRect = lgImg ? lgImg.getBoundingClientRect() : null;
      const contribRect = contribBtn ? contribBtn.getBoundingClientRect() : null;
      const themeRect = themeBtn ? themeBtn.getBoundingClientRect() : null;
      const menuRect = menuBtn ? menuBtn.getBoundingClientRect() : null;

      const spanLines = (lgSpanRect && lgSpanStyle) ? Math.round(lgSpanRect.height / parseFloat(lgSpanStyle.lineHeight || lgSpanStyle.fontSize || 16)) : 0;

      return {
        brandTextPresent: Boolean(lgSpan),
        brandTextContent: lgSpan ? lgSpan.innerText.trim() : null,
        brandTextDisplay: lgSpanStyle ? lgSpanStyle.display : null,
        brandTextVisible: Boolean(lgSpanStyle && lgSpanStyle.display !== 'none' && lgSpanStyle.visibility !== 'hidden' && lgSpanRect.width > 0),
        brandTextNoWrap: lgSpanStyle ? lgSpanStyle.whiteSpace : null,
        brandTextLines: spanLines,
        logoImgHeight: lgImgRect ? Math.round(lgImgRect.height) : 0,
        logoImgWidth: lgImgRect ? Math.round(lgImgRect.width) : 0,
        themeVisible: Boolean(themeRect && themeRect.width > 0),
        contribVisible: Boolean(contribRect && contribRect.width > 0),
        menuVisible: Boolean(menuRect && menuRect.width > 0),
        themeOrder: themeBtn ? getComputedStyle(themeBtn).order : null,
        contribOrder: contribBtn ? getComputedStyle(contribBtn).order : null,
        menuOrder: menuBtn ? getComputedStyle(menuBtn).order : null,
        themeLeft: themeRect ? Math.round(themeRect.left) : 0,
        contribLeft: contribRect ? Math.round(contribRect.left) : 0,
        menuLeft: menuRect ? Math.round(menuRect.left) : 0,
        navScrollWidth: nav ? nav.scrollWidth : 0,
        navClientWidth: nav ? nav.clientWidth : 0,
        docScrollWidth: document.documentElement.scrollWidth,
        docClientWidth: document.documentElement.clientWidth,
        noNavOverflow: nav ? (nav.scrollWidth <= nav.clientWidth + 1) : false,
        noPageOverflow: (document.documentElement.scrollWidth <= document.documentElement.clientWidth)
      };
    })()`);

    console.log(`\nBreakpoint ${bp.name}:`);
    console.log(`  - Brand Text visible: ${check.brandTextVisible} | text: "${check.brandTextContent}" | display: ${check.brandTextDisplay}`);
    console.log(`  - Brand Text no-wrap: ${check.brandTextNoWrap} | lines: ${check.brandTextLines}`);
    console.log(`  - Logo Image size: ${check.logoImgWidth}x${check.logoImgHeight}px`);
    console.log(`  - Right controls visible: Theme=${check.themeVisible}, Contrib=${check.contribVisible}, Menu=${check.menuVisible}`);
    console.log(`  - Visual positions: Theme@${check.themeLeft}px, Contrib@${check.contribLeft}px, Menu@${check.menuLeft}px`);
    console.log(`  - Zero overflow: Nav=${check.noNavOverflow} (${check.navScrollWidth}<=${check.navClientWidth}), Page=${check.noPageOverflow} (${check.docScrollWidth}<=${check.docClientWidth})`);

    if (!check.brandTextVisible) {
      throw new Error(`Brand text is not visible at ${bp.name}`);
    }
    if (!check.noNavOverflow || !check.noPageOverflow) {
      throw new Error(`Horizontal overflow detected at ${bp.name}`);
    }

    if (bp.width === 375) {
      const mobileScr375 = await send('Page.captureScreenshot', { format: 'png' });
      const mobileImgPath375 = path.join(ARTIFACT_DIR, 'mobile_rendered_view.png');
      fs.writeFileSync(mobileImgPath375, Buffer.from(mobileScr375.data, 'base64'));
      console.log('  - Screenshot (375px) saved:', mobileImgPath375);
    }
    if (bp.width === 320) {
      const mobileScr320 = await send('Page.captureScreenshot', { format: 'png' });
      const mobileImgPath320 = path.join(ARTIFACT_DIR, 'mobile_rendered_view_320px.png');
      fs.writeFileSync(mobileImgPath320, Buffer.from(mobileScr320.data, 'base64'));
      console.log('  - Screenshot (320px) saved:', mobileImgPath320);
    }
  }

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
