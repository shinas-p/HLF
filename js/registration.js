/**
 * HLF 2026 — In-Website Registration & Dynamic Supabase Integration
 * Integrates directly with Supabase Database & Storage (Row Level Security enabled)
 */

(function () {
  'use strict';

  let activeRegistrationData = null;
  let activeContributionData = null;
  let selectedScreenshotFile = null;
  let selectedContribScreenshotFile = null;

  const HLF_INSTITUTIONS = [
    "Darul Huda Nedumangadu Campus",
    "Darul Huda Central Campus, Chemmad",
    "Islahul Uloom Arabic College, Tanur",
    "Sabeelul Hidaya Islamic College, Parappur",
    "Maunathul Islam Arabic College, Ponnani",
    "Darul Hidaya Da'wa College, Manur",
    "MIC Darul Irshad Academy, Uduma",
    "Malik Deenar Islamic Academy, Thalangara",
    "Darul Hasanath Islamic College, Kannadipparamba",
    "Darunnajath Arabic College, Koonanchery",
    "Busthanul Uloom Arabic College, Maniyoor",
    "Darunajath Islamic Complex, Vallapuzha",
    "Manhajurrashad Islamic College, Chelembra",
    "Nahjurrashad Islamic College, Chamakkala",
    "Shaikh Fareed Auliya Da'wa College, Odamala",
    "Darul Uloom Islamic Da'wa College, Thootha",
    "Darul Falah Islamic Academy, Taliparamba",
    "Darul Irfan Islamic Academy, Pandikkad",
    "K.M.O Islamic Academy, Koduvally",
    "Al Hidaya Islamic Academy, Kalamassery",
    "Noorul Hidaya Islamic Academy Pattambi",
    "Shamsul Huda Islamic Academy, Kuttikkattur",
    "Madinul Uloom Islamic Academy, Arattupuzha",
    "Darulssalam Academy, Velliyode",
    "Daruthaqwa Islamic Academy, Pulikkani",
    "Jabalunnoor Islamic Complex, Perambra",
    "Daru Rahma Arabic College, Kodakkal",
    "Irshadiyya Islamic Complex",
    "Shamsul Ulama Smaraka Islamic Academy",
    "Quvvathul Islam Arabic College, Mumbai",
    "Darunnor Education Center, Kashipatna",
    "Noorul Huda Islamic Academy, Madannoor",
    "Siddeeq Moula Arabic College, Amini Dweep",
    "Other"
  ];

  function bootHLFInteractions() {
    if (window.__HLF_INTERACTIONS_READY) return;
    window.__HLF_INTERACTIONS_READY = true;

    try {
      injectRegistrationModal();
    } catch (error) {
      console.error('Registration modal initialization failed:', error);
    }

    try {
      injectContributionModal();
    } catch (error) {
      console.error('Contribution modal initialization failed:', error);
    }

    try {
      setupRegisterButtons();
    } catch (error) {
      console.error('Register button initialization failed:', error);
    }

    try {
      setupContributionButtons();
    } catch (error) {
      console.error('Contribution button initialization failed:', error);
    }

    try {
      setupContactQR();
    } catch (error) {
      console.error('Contact QR initialization failed:', error);
    }

    try {
      loadSupabaseData();
    } catch (error) {
      console.error('Supabase dynamic data sync failed:', error);
    }

    // Check for #register in URL
    if (window.location.hash === '#register') {
      setTimeout(() => {
        try { openRegistrationModal(); } catch (e) {}
      }, 150);
    }
  }

  // 1. Inject Registration Modal into Document
  function injectRegistrationModal() {
    if (document.getElementById('reg-dialog')) return;

    const paymentCfg = (window.HLF_CONFIG && window.HLF_CONFIG.payment) || {
      fee: 50,
      upiId: 'hlf2026@dhiu',
      payeeName: 'Hadith Literature Festival DHIU',
      qrImagePath: ''
    };

    const dialog = document.createElement('dialog');
    dialog.id = 'reg-dialog';
    dialog.className = 'reg-dialog glass';
    dialog.innerHTML = `
      <div class="reg-dialog-inner">
        <!-- Close Button -->
        <button type="button" class="reg-close-btn" id="reg-close-x" aria-label="Close">×</button>

        <!-- STEP 1: PARTICIPANT INFORMATION -->
        <div id="reg-step1-view">
          <div class="reg-dialog-header">
            <p class="tag"><b>[REGISTRATION]</b> ✦ HLF 2026</p>
            <h2 class="reg-title">Delegate Registration</h2>
            <p class="reg-subtitle">Hadith Literature Festival · 18–20 October 2026 · Chemmad, Kerala</p>
            
            <div class="reg-fee-badge">
              <span class="fee-label">FEE</span>
              <span class="fee-val">₹${paymentCfg.fee}</span>
              <span class="fee-desc">Official Entry & Delegate Access</span>
            </div>
          </div>

          <!-- Step Indicator -->
          <div class="reg-step-tracker">
            <div class="reg-step-pill active" id="tracker-step-1">
              <span class="step-dot">1</span>
              <span>Participant Details</span>
            </div>
            <span class="reg-step-arrow">→</span>
            <div class="reg-step-pill" id="tracker-step-2">
              <span class="step-dot">2</span>
              <span>₹50 UPI Payment</span>
            </div>
            <span class="reg-step-arrow">→</span>
            <div class="reg-step-pill" id="tracker-step-3">
              <span class="step-dot">3</span>
              <span>Confirmation</span>
            </div>
          </div>

          <form id="hlf-step1-form" novalidate>
            <div class="reg-form-section">
              <h3 class="reg-section-title"><span class="step">1</span> Participant Information</h3>
              <div class="reg-grid">
                <!-- Full Name -->
                <div class="reg-field reg-col-2">
                  <label class="reg-label" for="reg-fullname">Full Name <span class="req">*</span></label>
                  <input type="text" id="reg-fullname" class="reg-input" placeholder="e.g. Sayyid Ahmed" required autocomplete="name">
                </div>

                <!-- Mobile -->
                <div class="reg-field">
                  <label class="reg-label" for="reg-mobile">Mobile Number <span class="req">*</span></label>
                  <input type="tel" id="reg-mobile" class="reg-input" placeholder="10-digit mobile number" maxlength="10" required autocomplete="tel">
                </div>

                <!-- Email -->
                <div class="reg-field">
                  <label class="reg-label" for="reg-email">Email Address <span class="opt">(Optional)</span></label>
                  <input type="email" id="reg-email" class="reg-input" placeholder="name@example.com" autocomplete="email">
                </div>

                <!-- College / Institution (Required Searchable Dropdown) -->
                <div class="reg-field reg-col-2">
                  <label class="reg-label" for="reg-institution-search">College / Institution <span class="req">*</span></label>
                  <div class="reg-combobox" id="inst-combobox">
                    <div class="reg-combobox-input-wrap">
                      <input type="text" id="reg-institution-search" class="reg-input" placeholder="Type to search or select institution..." autocomplete="off">
                      <button type="button" class="reg-combobox-toggle" id="inst-toggle-btn" tabindex="-1" aria-label="Toggle dropdown">▾</button>
                    </div>
                    <input type="hidden" id="reg-institution" value="">
                    <div class="reg-combobox-dropdown" id="inst-dropdown" style="display: none;">
                      <ul class="reg-combobox-list" id="inst-options-list"></ul>
                    </div>
                  </div>
                </div>

                <!-- Custom Institution Field (Shown when 'Other' selected) -->
                <div class="reg-field reg-col-2" id="reg-other-institution-group" style="display: none;">
                  <label class="reg-label" for="reg-other-institution">Institution Name <span class="req">*</span></label>
                  <input type="text" id="reg-other-institution" class="reg-input" placeholder="Enter your full college / institution name">
                </div>

                <!-- Course / Class -->
                <div class="reg-field">
                  <label class="reg-label" for="reg-course">Course / Class <span class="opt">(Optional)</span></label>
                  <input type="text" id="reg-course" class="reg-input" placeholder="e.g. Degree / PG / Sanad">
                </div>

                <!-- Department -->
                <div class="reg-field">
                  <label class="reg-label" for="reg-department">Department <span class="opt">(Optional)</span></label>
                  <input type="text" id="reg-department" class="reg-input" placeholder="e.g. Hadith & Related Sciences">
                </div>

                <!-- District -->
                <div class="reg-field reg-col-2">
                  <label class="reg-label" for="reg-district">District / State <span class="opt">(Optional)</span></label>
                  <input type="text" id="reg-district" class="reg-input" placeholder="e.g. Malappuram, Kerala">
                </div>

                <!-- Special Requirements / Notes -->
                <div class="reg-field reg-col-2">
                  <label class="reg-label" for="reg-notes">Special Requirements / Notes <span class="opt">(Optional)</span></label>
                  <textarea id="reg-notes" class="reg-textarea" rows="2" placeholder="Any accessibility or travel notes"></textarea>
                </div>
              </div>
            </div>

            <!-- Consent -->
            <label class="reg-consent-box">
              <input type="checkbox" id="reg-consent" required>
              <span>I confirm that the details provided are accurate and agree to register for HLF 2026.</span>
            </label>

            <!-- Error Banner -->
            <div id="reg-error-banner-1" class="reg-error-msg" role="alert"></div>

            <!-- Submit Button Step 1 -->
            <button type="submit" id="reg-step1-btn" class="btn p" style="width: 100%; justify-content: center; font-size: 1.05rem; padding: 16px;">
              <span>Proceed to ₹50 UPI Payment →</span>
            </button>
          </form>
        </div>

        <!-- STEP 2: UPI PAYMENT SECTION -->
        <div id="reg-step2-view" style="display: none;">
          <div class="reg-dialog-header">
            <p class="tag"><b>[STEP 2/2]</b> ✦ UPI PAYMENT</p>
            <h2 class="reg-title">Complete ₹50 Payment</h2>
            <p class="reg-subtitle">Scan QR or pay via any UPI app to confirm your delegate registration</p>
          </div>

          <!-- Step Indicator -->
          <div class="reg-step-tracker">
            <div class="reg-step-pill completed">
              <span class="step-dot">✓</span>
              <span>Details Saved</span>
            </div>
            <span class="reg-step-arrow">→</span>
            <div class="reg-step-pill active">
              <span class="step-dot">2</span>
              <span>₹50 UPI Payment</span>
            </div>
            <span class="reg-step-arrow">→</span>
            <div class="reg-step-pill">
              <span class="step-dot">3</span>
              <span>Confirmation</span>
            </div>
          </div>

          <!-- Allocated Reg ID Card -->
          <div class="reg-allocated-box">
            <div class="alloc-left">
              <span class="alloc-label">Allocated Registration ID</span>
              <span class="alloc-id" id="step2-reg-id">HLF26-XXXX</span>
            </div>
            <button type="button" class="reg-btn-sm" id="step2-copy-id-btn">
              <span>📋</span> <span id="step2-copy-id-text">Copy ID</span>
            </button>
          </div>

          <!-- UPI Payment Card -->
          <div class="reg-pay-card">
            <div class="reg-qr-wrap">
              <div class="reg-qr-box" id="reg-qr-container">
                <div id="reg-qr-canvas"></div>
                ${paymentCfg.qrImagePath ? `<img id="reg-qr-img" src="${paymentCfg.qrImagePath}" alt="HLF UPI QR" style="display:none;" onerror="this.style.display='none'; document.getElementById('reg-qr-canvas').style.display='block';">` : ''}
              </div>
              <span style="font-size: 11px; color: var(--mute);">Scan with any UPI App</span>
            </div>

            <div class="reg-pay-info">
              <div class="upi-details">
                <span class="upi-label">Registration Fee</span>
                <span style="font-size: 1.4rem; font-weight: 700; color: var(--red);">₹50.00</span>
              </div>
              <div class="upi-details">
                <span class="upi-label">UPI ID</span>
                <span class="upi-val" id="reg-upi-id-text">${paymentCfg.upiId}</span>
              </div>
              <div class="upi-details">
                <span class="upi-label">Payee Name</span>
                <span style="font-size: 13px; font-weight: 500; color: var(--ink);">${paymentCfg.payeeName}</span>
              </div>

              <div class="reg-pay-actions">
                <button type="button" class="reg-btn-sm" id="reg-copy-upi-btn">
                  <span>📋</span> <span id="reg-copy-text">Copy UPI ID</span>
                </button>
                <a href="#" class="reg-btn-sm primary" id="reg-pay-intent-btn" target="_blank" rel="noopener">
                  <span>⚡</span> Pay ₹50 via UPI App
                </a>
              </div>

              <div class="reg-payment-notice">
                <strong>How to complete payment:</strong><br>
                1. Tap <strong>Pay ₹50 via UPI</strong> or scan the QR code using Google Pay, PhonePe, Paytm, BHIM, etc.<br>
                2. Complete the ₹50 registration payment.<br>
                3. Take a screenshot showing your completed payment receipt.<br>
                4. Upload the screenshot below and complete your registration.
              </div>
            </div>
          </div>

          <form id="hlf-step2-form" novalidate>
            <!-- Payment Transaction Screenshot Upload -->
            <div class="reg-field" style="margin-bottom: 18px;">
              <label class="reg-label">Payment Transaction Screenshot <span class="req">*</span></label>
              <p style="font-size: 11px; color: var(--mute); margin: 0 0 10px;">Upload a screenshot showing your ₹50 UPI payment transaction.</p>
              
              <div class="reg-screenshot-zone" id="reg-screenshot-zone">
                <input type="file" id="reg-screenshot-file" accept="image/jpeg,image/png,image/webp" style="display: none;">
                <div id="reg-screenshot-prompt">
                  <div style="font-size: 32px; margin-bottom: 6px;">📸</div>
                  <div style="font-size: 13px; font-weight: 600; color: var(--teal);">Click or drag & drop payment screenshot</div>
                  <div style="font-size: 11px; color: var(--mute); margin-top: 4px;">Supports JPG, PNG, WEBP (Max 5 MB)</div>
                </div>
                
                <div id="reg-screenshot-preview" style="display: none;" class="reg-screenshot-preview">
                  <img id="reg-screenshot-preview-img" src="" alt="Payment Screenshot" class="reg-screenshot-thumb">
                  <div class="reg-screenshot-meta">
                    <div id="reg-screenshot-filename" class="name">—</div>
                    <div id="reg-screenshot-filesize" class="size">—</div>
                    <div style="display: flex; gap: 8px; margin-top: 6px;">
                      <button type="button" class="reg-btn-sm" id="reg-screenshot-change-btn">Change</button>
                      <button type="button" class="reg-btn-sm danger" id="reg-screenshot-remove-btn">Remove</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Error Banner Step 2 -->
            <div id="reg-error-banner-2" class="reg-error-msg" role="alert"></div>

            <div class="reg-nav-actions">
              <button type="button" class="btn" id="step2-back-btn" style="flex: 0 0 auto;">
                ← Back
              </button>
              <button type="submit" id="reg-step2-btn" class="btn p">
                <span>Confirm Payment & Complete Registration ✦</span>
              </button>
            </div>
          </form>
        </div>

        <!-- STEP 3: CONFIRMATION SUCCESS VIEW -->
        <div id="reg-success-view" class="reg-success-view">
          <div class="reg-success-icon">🎉</div>
          <h2 class="reg-success-title">Registration Submitted</h2>
          <p class="reg-success-sub">Your delegate registration for HLF 2026 has been received.</p>

          <div class="reg-id-card">
            <span class="id-label">OFFICIAL REGISTRATION ID</span>
            <div class="id-number" id="success-reg-id">HLF26-XXXX</div>
            <div style="margin-top: 10px;">
              <span class="reg-status-pill pending" id="success-reg-status">Pending Verification</span>
            </div>
            <div style="margin-top: 14px;">
              <button type="button" class="reg-btn-sm" id="success-copy-id-btn">📋 Copy Registration ID</button>
            </div>
          </div>

          <table class="reg-details-table">
            <tr><td>Participant Name:</td><td id="success-name">—</td></tr>
            <tr><td>Institution:</td><td id="success-inst">—</td></tr>
            <tr><td>Mobile Number:</td><td id="success-mobile">—</td></tr>
            <tr><td>Registration Fee:</td><td><strong>₹50</strong></td></tr>
            <tr><td>Payment Status:</td><td><span class="reg-status-pill pending">Pending Verification</span></td></tr>
            <tr><td>Submission Date/Time:</td><td id="success-date">—</td></tr>
          </table>

          <div class="reg-instructions-box">
            <strong>Important Instructions:</strong><br>
            • Please save or screenshot your Registration ID.<br>
            • Your UPI payment will be manually verified by the HLF registration committee.<br>
            • Present this Registration ID at the HLF reception counter on 18 October 2026 at Darul Huda Islamic University, Chemmad to collect your official delegate badge and festival kit.
          </div>

          <div class="reg-success-actions">
            <button type="button" class="btn p" id="success-print-btn">🖨️ Print / Download Confirmation Pass</button>
            <button type="button" class="btn" id="success-close-btn">Done / Return to Site</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Bind Dialog Events
    document.getElementById('reg-close-x').onclick = closeRegistrationModal;
    document.getElementById('success-close-btn').onclick = closeRegistrationModal;
    document.getElementById('success-print-btn').onclick = printRegistrationConfirmation;
    document.getElementById('success-copy-id-btn').onclick = copyRegistrationId;

    // Close when clicking dialog backdrop
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                          rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        closeRegistrationModal();
      }
    });

    // Restore body scroll on cancel/close
    dialog.addEventListener('close', () => {
      document.body.style.overflow = '';
    });
    dialog.addEventListener('cancel', () => {
      document.body.style.overflow = '';
    });

    // Step 2 Back Button
    document.getElementById('step2-back-btn').onclick = () => {
      showStep(1);
    };

    // Copy Allocated ID in Step 2
    document.getElementById('step2-copy-id-btn').onclick = async () => {
      if (!activeRegistrationData || !activeRegistrationData.registration_id) return;
      try {
        await navigator.clipboard.writeText(activeRegistrationData.registration_id);
        const txt = document.getElementById('step2-copy-id-text');
        txt.textContent = 'Copied ✓';
        setTimeout(() => { txt.textContent = 'Copy ID'; }, 2000);
      } catch (e) {}
    };

    // Copy UPI ID Button
    document.getElementById('reg-copy-upi-btn').onclick = async () => {
      const upiId = (window.HLF_CONFIG && window.HLF_CONFIG.payment && window.HLF_CONFIG.payment.upiId) || 'hlf2026@dhiu';
      try {
        await navigator.clipboard.writeText(upiId);
        const copyTxt = document.getElementById('reg-copy-text');
        copyTxt.textContent = 'Copied ✓';
        setTimeout(() => { copyTxt.textContent = 'Copy UPI ID'; }, 2000);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    };

    // Form Submissions
    document.getElementById('hlf-step1-form').onsubmit = handleStep1Submit;
    document.getElementById('hlf-step2-form').onsubmit = handleStep2Submit;

    // Initialize Combobox and Upload
    setupInstitutionCombobox();
    setupScreenshotUpload();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Searchable Dropdown for College / Institution
  function setupInstitutionCombobox() {
    const combobox = document.getElementById('inst-combobox');
    const searchInput = document.getElementById('reg-institution-search');
    const toggleBtn = document.getElementById('inst-toggle-btn');
    const dropdown = document.getElementById('inst-dropdown');
    const list = document.getElementById('inst-options-list');
    const hiddenInput = document.getElementById('reg-institution');
    const otherGroup = document.getElementById('reg-other-institution-group');
    const otherInput = document.getElementById('reg-other-institution');

    if (!combobox || !searchInput || !dropdown || !list || !hiddenInput) return;

    let activeIndex = -1;
    let filteredList = [...HLF_INSTITUTIONS];

    function renderList(query = '') {
      list.innerHTML = '';
      const q = query.toLowerCase().trim();
      filteredList = HLF_INSTITUTIONS.filter(inst => inst.toLowerCase().includes(q));

      if (filteredList.length === 0) {
        list.innerHTML = `
          <li class="reg-combobox-empty">No matching colleges found.</li>
          <li class="reg-combobox-item" data-value="Other">
            <span>Other</span>
            <span style="font-size: 11px; opacity: 0.7;">Enter custom institution</span>
          </li>`;
        const otherItem = list.querySelector('[data-value="Other"]');
        if (otherItem) {
          otherItem.onclick = () => selectItem('Other');
        }
        return;
      }

      filteredList.forEach((inst, idx) => {
        const li = document.createElement('li');
        li.className = 'reg-combobox-item' + (hiddenInput.value === inst ? ' selected' : '');
        li.dataset.value = inst;
        li.dataset.index = idx;
        
        if (q && inst.toLowerCase().includes(q) && inst !== 'Other') {
          const matchStart = inst.toLowerCase().indexOf(q);
          const matchEnd = matchStart + q.length;
          li.innerHTML = `<span>${escapeHtml(inst.slice(0, matchStart))}<strong style="color:var(--teal);text-decoration:underline;">${escapeHtml(inst.slice(matchStart, matchEnd))}</strong>${escapeHtml(inst.slice(matchEnd))}</span>`;
        } else {
          li.innerHTML = `<span>${escapeHtml(inst)}</span>`;
        }

        if (inst === 'Other') {
          li.innerHTML += `<span style="font-size: 11px; opacity: 0.7;">Custom Name</span>`;
        }

        li.onclick = (e) => {
          e.stopPropagation();
          selectItem(inst);
        };

        list.appendChild(li);
      });
    }

    function openDropdown() {
      renderList(searchInput.value === hiddenInput.value ? '' : searchInput.value);
      dropdown.style.display = 'block';
      combobox.classList.add('open');
      activeIndex = -1;
    }

    function closeDropdown() {
      dropdown.style.display = 'none';
      combobox.classList.remove('open');
      activeIndex = -1;
      if (hiddenInput.value && !searchInput.value) {
        hiddenInput.value = '';
        if (otherGroup) otherGroup.style.display = 'none';
      } else if (hiddenInput.value) {
        searchInput.value = hiddenInput.value;
      }
    }

    function selectItem(val) {
      hiddenInput.value = val;
      searchInput.value = val;
      closeDropdown();

      if (val === 'Other') {
        if (otherGroup) {
          otherGroup.style.display = 'block';
          if (otherInput) {
            otherInput.required = true;
            setTimeout(() => otherInput.focus(), 50);
          }
        }
      } else {
        if (otherGroup) {
          otherGroup.style.display = 'none';
          if (otherInput) {
            otherInput.required = false;
            otherInput.value = '';
          }
        }
      }
    }

    searchInput.addEventListener('focus', () => {
      openDropdown();
    });

    searchInput.addEventListener('click', () => {
      openDropdown();
    });

    searchInput.addEventListener('input', () => {
      openDropdown();
      if (hiddenInput.value && searchInput.value !== hiddenInput.value) {
        hiddenInput.value = '';
        if (otherGroup) otherGroup.style.display = 'none';
      }
    });

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropdown.style.display === 'block') {
          closeDropdown();
        } else {
          openDropdown();
          searchInput.focus();
        }
      });
    }

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      const items = list.querySelectorAll('.reg-combobox-item');
      if (dropdown.style.display !== 'block') {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          openDropdown();
          return;
        }
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length > 0) {
          activeIndex = (activeIndex + 1) % items.length;
          updateActiveItem(items);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length > 0) {
          activeIndex = (activeIndex - 1 + items.length) % items.length;
          updateActiveItem(items);
        }
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && items[activeIndex]) {
          e.preventDefault();
          selectItem(items[activeIndex].dataset.value);
        }
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    function updateActiveItem(items) {
      items.forEach((it, idx) => {
        if (idx === activeIndex) {
          it.classList.add('active');
          it.scrollIntoView({ block: 'nearest' });
        } else {
          it.classList.remove('active');
        }
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!combobox.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  // Payment Transaction Screenshot Upload
  function setupScreenshotUpload() {
    const zone = document.getElementById('reg-screenshot-zone');
    const fileInput = document.getElementById('reg-screenshot-file');
    const promptBox = document.getElementById('reg-screenshot-prompt');
    const previewBox = document.getElementById('reg-screenshot-preview');
    const previewImg = document.getElementById('reg-screenshot-preview-img');
    const filenameEl = document.getElementById('reg-screenshot-filename');
    const filesizeEl = document.getElementById('reg-screenshot-filesize');
    const changeBtn = document.getElementById('reg-screenshot-change-btn');
    const removeBtn = document.getElementById('reg-screenshot-remove-btn');

    if (!zone || !fileInput) return;

    zone.onclick = (e) => {
      if (e.target.closest('#reg-screenshot-remove-btn') || e.target.closest('#reg-screenshot-change-btn')) {
        return;
      }
      fileInput.click();
    };

    if (changeBtn) {
      changeBtn.onclick = (e) => {
        e.stopPropagation();
        fileInput.click();
      };
    }

    if (removeBtn) {
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        resetScreenshot();
      };
    }

    // Drag and drop
    zone.ondragover = (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    };
    zone.ondragleave = () => {
      zone.classList.remove('dragover');
    };
    zone.ondrop = (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processSelectedFile(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        processSelectedFile(e.target.files[0]);
      }
    };

    function processSelectedFile(file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        showError(2, 'Please upload a valid image file (JPG, PNG, or WEBP).');
        resetScreenshot();
        return;
      }

      // Max size: 5 MB (5 * 1024 * 1024 bytes)
      if (file.size > 5 * 1024 * 1024) {
        showError(2, 'Image file size exceeds 5 MB. Please select a smaller screenshot.');
        resetScreenshot();
        return;
      }

      // Clear previous error
      const err = document.getElementById('reg-error-banner-2');
      if (err) { err.style.display = 'none'; err.textContent = ''; }

      selectedScreenshotFile = file;

      // Render preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        previewImg.src = ev.target.result;
        filenameEl.textContent = file.name;
        filesizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        promptBox.style.display = 'none';
        previewBox.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    }

    function resetScreenshot() {
      selectedScreenshotFile = null;
      fileInput.value = '';
      previewImg.src = '';
      filenameEl.textContent = '—';
      filesizeEl.textContent = '—';
      previewBox.style.display = 'none';
      promptBox.style.display = 'block';
    }
  }

  // Helper to switch view steps
  function showStep(stepNum) {
    const s1 = document.getElementById('reg-step1-view');
    const s2 = document.getElementById('reg-step2-view');
    const s3 = document.getElementById('reg-success-view');

    if (s1) s1.style.display = stepNum === 1 ? 'block' : 'none';
    if (s2) s2.style.display = stepNum === 2 ? 'block' : 'none';
    if (s3) s3.style.display = stepNum === 3 ? 'block' : 'none';

    // Clear error banners
    const err1 = document.getElementById('reg-error-banner-1');
    const err2 = document.getElementById('reg-error-banner-2');
    if (err1) { err1.style.display = 'none'; err1.textContent = ''; }
    if (err2) { err2.style.display = 'none'; err2.textContent = ''; }

    // Scroll inner container to top
    const inner = document.querySelector('.reg-dialog-inner');
    if (inner) inner.scrollTop = 0;
  }

  // 2. Setup UPI Intent & QR Code with Registration ID
  function renderUpiPaymentControls(regId) {
    const paymentCfg = (window.HLF_CONFIG && window.HLF_CONFIG.payment) || {
      fee: 50,
      upiId: 'hlf2026@dhiu',
      payeeName: 'Hadith Literature Festival DHIU'
    };

    const noteText = regId ? `HLF 2026 Registration - ${regId}` : 'HLF 2026 Registration';
    const upiQuery = `pa=${encodeURIComponent(paymentCfg.upiId)}&pn=${encodeURIComponent(paymentCfg.payeeName)}&am=${paymentCfg.fee}&cu=INR&tn=${encodeURIComponent(noteText)}`;
    const upiIntentUrl = `upi://pay?${upiQuery}`;

    const intentBtn = document.getElementById('reg-pay-intent-btn');
    if (intentBtn) {
      intentBtn.href = upiIntentUrl;
    }

    const upiText = document.getElementById('reg-upi-id-text');
    if (upiText) {
      upiText.textContent = paymentCfg.upiId;
    }

    if (regId) {
      const step2Id = document.getElementById('step2-reg-id');
      if (step2Id) step2Id.textContent = regId;
    }

    // Render QR Code in canvas container using QRCode library
    const qrCanvas = document.getElementById('reg-qr-canvas');
    if (qrCanvas && window.QRCode) {
      qrCanvas.innerHTML = '';
      try {
        new window.QRCode(qrCanvas, {
          text: upiIntentUrl,
          width: 140,
          height: 140,
          colorDark: '#0b2a22',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } catch (e) {
        console.warn('QR code generation warning:', e);
      }
    }
  }

  // 3. Connect all Register Buttons in Document
  function setupRegisterButtons() {
    document.querySelectorAll('.reg').forEach(el => {
      el.removeAttribute('target');
      el.setAttribute('role', 'button');
      el.style.cursor = 'pointer';
      if (el.tagName && el.tagName.toLowerCase() === 'a') {
        el.setAttribute('href', 'javascript:void(0)');
      }
      el.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openRegistrationModal();
      };
    });
  }

  // 4. Update Contact Section QR Code to point to internal registration
  function setupContactQR() {
    const qrTarget = document.getElementById('qr');
    if (qrTarget && window.QRCode) {
      qrTarget.innerHTML = '';
      const regUrl = window.location.origin + window.location.pathname + '#register';
      try {
        new window.QRCode(qrTarget, {
          text: regUrl,
          width: 200,
          height: 200,
          colorDark: '#0b2a22',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } catch (e) {}
    }
  }

  // 5. Open / Close Modal Helpers
  function openRegistrationModal() {
    const dialog = document.getElementById('reg-dialog');
    if (!dialog) return;

    // Lock page background scrolling
    document.body.style.overflow = 'hidden';

    // Show Step 1 unless already in Step 2 with allocated ID
    if (activeRegistrationData && activeRegistrationData.registration_id && !activeRegistrationData.submitted_final) {
      showStep(2);
      renderUpiPaymentControls(activeRegistrationData.registration_id);
    } else {
      showStep(1);
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeRegistrationModal() {
    const dialog = document.getElementById('reg-dialog');
    if (!dialog) return;

    // Restore background scrolling
    document.body.style.overflow = '';

    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }

    if (window.location.hash === '#register') {
      history.replaceState(null, '', window.location.pathname);
    }
  }

  // 6. Handle Step 1 Submission: Participant Details -> Allocate Registration ID
  async function handleStep1Submit(e) {
    e.preventDefault();

    const errBanner = document.getElementById('reg-error-banner-1');
    if (errBanner) {
      errBanner.style.display = 'none';
      errBanner.textContent = '';
    }

    const fullName = document.getElementById('reg-fullname').value.trim();
    const mobile = document.getElementById('reg-mobile').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const course = document.getElementById('reg-course').value.trim();
    const department = document.getElementById('reg-department').value.trim();
    const district = document.getElementById('reg-district').value.trim();
    const notes = document.getElementById('reg-notes').value.trim();
    const consent = document.getElementById('reg-consent').checked;

    // Validation
    if (!fullName || fullName.length < 2) {
      showError(1, 'Please enter your full name (minimum 2 characters).');
      document.getElementById('reg-fullname').focus();
      return;
    }

    const mobileClean = mobile.replace(/[\s-]/g, '');
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobileClean)) {
      showError(1, 'Please enter a valid 10-digit Indian mobile number.');
      document.getElementById('reg-mobile').focus();
      return;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError(1, 'Please enter a valid email address.');
        document.getElementById('reg-email').focus();
        return;
      }
    }

    const selectedInst = (document.getElementById('reg-institution')?.value || '').trim();
    if (!selectedInst) {
      showError(1, 'Please select your college / institution.');
      document.getElementById('reg-institution-search')?.focus();
      return;
    }

    let finalInstitution = selectedInst;
    if (selectedInst === 'Other') {
      const customInst = (document.getElementById('reg-other-institution')?.value || '').trim();
      if (!customInst || customInst.length < 2) {
        showError(1, 'Please enter your college / institution name.');
        document.getElementById('reg-other-institution')?.focus();
        return;
      }
      finalInstitution = customInst;
    }

    if (!consent) {
      showError(1, 'Please check the consent box to confirm that your information is accurate.');
      document.getElementById('reg-consent').focus();
      return;
    }

    // Submit details via Supabase initiate_registration RPC
    const submitBtn = document.getElementById('reg-step1-btn');
    const origBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="reg-spinner"></span> Generating Registration ID...`;

    try {
      const sb = window.getSupabase ? window.getSupabase() : null;
      if (!sb) {
        throw new Error('Supabase client could not be initialized. Please check network connection.');
      }

      // If we already initiated and have an ID, we can proceed or update
      let regId = activeRegistrationData ? activeRegistrationData.registration_id : null;

      if (!regId) {
        const { data, error } = await sb.rpc('initiate_registration', {
          p_full_name: fullName,
          p_mobile: mobileClean,
          p_institution: finalInstitution,
          p_email: email || null,
          p_course: course || null,
          p_department: department || null,
          p_district: district || null,
          p_special_requirements: notes || null
        });

        if (error) {
          console.error('Registration initiate RPC error:', error);
          throw new Error(error.message || 'Could not initiate registration. Please try again.');
        }

        if (!data || !data.success) {
          throw new Error('Unexpected response from registration service.');
        }

        regId = data.registration_id;
        activeRegistrationData = {
          registration_id: regId,
          full_name: fullName,
          institution: finalInstitution,
          mobile: mobileClean,
          email: email,
          registration_fee: 50,
          payment_status: 'pending',
          created_at: data.created_at || new Date().toISOString()
        };
      } else {
        // Update stored participant details
        activeRegistrationData.full_name = fullName;
        activeRegistrationData.institution = finalInstitution;
        activeRegistrationData.mobile = mobileClean;
      }

      // Switch to Step 2
      showStep(2);
      renderUpiPaymentControls(regId);

    } catch (err) {
      console.error('Step 1 error:', err);
      showError(1, err.message || 'An error occurred while saving your details. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }

  // 7. Handle Step 2 Submission: Upload Screenshot -> Save Payment
  async function handleStep2Submit(e) {
    e.preventDefault();

    const errBanner = document.getElementById('reg-error-banner-2');
    if (errBanner) {
      errBanner.style.display = 'none';
      errBanner.textContent = '';
    }

    if (!activeRegistrationData || !activeRegistrationData.registration_id) {
      showError(2, 'Registration session expired. Please return to Step 1 and try again.');
      return;
    }

    // Validate Payment Screenshot File
    if (!selectedScreenshotFile) {
      showError(2, 'Please upload your payment transaction screenshot before completing registration.');
      return;
    }

    const submitBtn = document.getElementById('reg-step2-btn');
    const origBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="reg-spinner"></span> Uploading Proof & Confirming...`;

    try {
      const sb = window.getSupabase ? window.getSupabase() : null;
      if (!sb) {
        throw new Error('Supabase client could not be initialized. Please check network connection.');
      }

      const regId = activeRegistrationData.registration_id;
      const fileExt = (selectedScreenshotFile.name.split('.').pop() || 'png').toLowerCase();
      const fileTimestamp = Date.now();
      const filePath = `registrations/${regId}/payment-proof-${fileTimestamp}.${fileExt}`;

      // Upload file to dedicated Supabase Storage bucket (pure INSERT without upsert to satisfy RLS)
      const { data: uploadData, error: uploadErr } = await sb.storage
        .from('hlf-payment-proofs')
        .upload(filePath, selectedScreenshotFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadErr) {
        console.error('Registration screenshot storage upload error:', uploadErr);
        throw new Error('Payment screenshot upload failed: ' + uploadErr.message);
      }

      const { data: publicUrlData } = sb.storage.from('hlf-payment-proofs').getPublicUrl(filePath);
      const screenshotUrl = publicUrlData ? publicUrlData.publicUrl : null;

      // Confirm registration with screenshot path and URL
      const { data, error } = await sb.rpc('confirm_registration_screenshot', {
        p_registration_id: regId,
        p_payment_screenshot_path: filePath,
        p_payment_screenshot_url: screenshotUrl
      });

      if (error) {
        console.error('Payment confirmation RPC error:', error);
        throw new Error('Payment screenshot database update failed: ' + (error.message || 'Confirmation failed'));
      }

      if (!data || !data.success) {
        throw new Error('Unexpected response from registration service.');
      }

      // Success
      activeRegistrationData.payment_screenshot_path = filePath;
      activeRegistrationData.payment_screenshot_url = screenshotUrl;
      activeRegistrationData.payment_status = 'pending';
      activeRegistrationData.submitted_final = true;

      displaySuccessView(activeRegistrationData);

    } catch (err) {
      console.error('Step 2 error:', err);
      showError(2, err.message || 'An error occurred while confirming payment. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }

  function showError(stepNum, msg) {
    const errBanner = document.getElementById(`reg-error-banner-${stepNum}`);
    if (errBanner) {
      errBanner.textContent = msg;
      errBanner.style.display = 'block';
      errBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // 8. Display Confirmation Screen (Step 3)
  function displaySuccessView(data) {
    showStep(3);

    document.getElementById('success-reg-id').textContent = data.registration_id;
    document.getElementById('success-name').textContent = data.full_name;
    document.getElementById('success-inst').textContent = data.institution;
    document.getElementById('success-mobile').textContent = data.mobile;

    const formattedDate = formatAcknowledgementDate(data.created_at);
    document.getElementById('success-date').textContent = formattedDate;

    // Scroll to top of dialog
    const inner = document.querySelector('.reg-dialog-inner');
    if (inner) inner.scrollTop = 0;
  }

  async function copyRegistrationId() {
    if (!activeRegistrationData || !activeRegistrationData.registration_id) return;
    try {
      await navigator.clipboard.writeText(activeRegistrationData.registration_id);
      const btn = document.getElementById('success-copy-id-btn');
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = '📋 Copy Registration ID'; }, 2000);
    } catch (err) {}
  }

  // 9. Printable Registration Confirmation
  function printRegistrationConfirmation() {
    if (!activeRegistrationData) return;
    const d = activeRegistrationData;
    const printDate = formatAcknowledgementDate(d.created_at);

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>HLF 2026 Registration Confirmation - ${d.registration_id}</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&display=swap">
        <style>
          body {
            font-family: 'Fira Code', monospace;
            padding: 40px;
            color: #17332d;
            background: #fff;
            max-width: 650px;
            margin: auto;
          }
          .ticket {
            border: 2px dashed #12907a;
            border-radius: 20px;
            padding: 30px;
            background: #fffef5;
          }
          .hdr {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #17332d;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .logo {
            font-size: 24px;
            font-weight: 700;
          }
          .logo span { color: #d0021b; }
          .reg-badge {
            background: #17332d;
            color: #fff;
            padding: 6px 12px;
            border-radius: 99px;
            font-size: 11px;
            font-weight: 700;
          }
          .reg-id-box {
            background: #f0eeb6;
            padding: 16px;
            border-radius: 12px;
            text-align: center;
            margin: 20px 0;
            border: 1px solid rgba(23,51,45,0.2);
          }
          .reg-id-val {
            font-size: 32px;
            font-weight: 700;
            color: #d0021b;
            letter-spacing: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          td {
            padding: 10px 4px;
            border-bottom: 1px solid rgba(23,51,45,0.12);
            font-size: 14px;
          }
          td.label {
            color: #4b625b;
            width: 40%;
          }
          .notice {
            background: rgba(18,144,122,0.1);
            border-left: 4px solid #12907a;
            padding: 12px;
            font-size: 12px;
            color: #17332d;
            margin-top: 20px;
            line-height: 1.5;
          }
          .ftr {
            text-align: center;
            margin-top: 30px;
            font-size: 11px;
            color: #4b625b;
          }
          @media print {
            body { padding: 0; background: none; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="hdr">
            <div>
              <div class="logo">HLF<span>✦</span>2026</div>
              <small>Hadith Literature Festival</small>
            </div>
            <div class="reg-badge">OFFICIAL REGISTRATION PASS</div>
          </div>

          <p style="margin: 0; color: #4b625b; font-size: 12px;">18–20 October 2026 · Darul Huda Islamic University, Chemmad, Kerala</p>

          <div class="reg-id-box">
            <small style="text-transform: uppercase; letter-spacing: 1px; color: #4b625b;">Registration Identification Number</small>
            <div class="reg-id-val">${d.registration_id}</div>
            <small style="color: #c07a00; font-weight: 700;">PAYMENT STATUS: PENDING MANUAL VERIFICATION</small>
          </div>

          <table>
            <tr><td class="label">Participant Name:</td><td><strong>${d.full_name}</strong></td></tr>
            <tr><td class="label">Institution:</td><td>${d.institution}</td></tr>
            <tr><td class="label">Mobile Number:</td><td>${d.mobile}</td></tr>
            <tr><td class="label">Registration Fee:</td><td><strong>₹${d.registration_fee || 50}</strong></td></tr>
            <tr><td class="label">Payment Status:</td><td><strong style="color: #c07a00;">PENDING VERIFICATION</strong></td></tr>
            <tr><td class="label">Submission Date & Time:</td><td>${printDate}</td></tr>
          </table>

          <div class="notice">
            <strong>Important Instructions:</strong><br>
            • Please present this slip along with a valid ID at the registration desk.<br>
            • Registration badge & festival kit will be handed over upon entry at DHIU Chemmad.<br>
            • For inquiries, contact: hadithliteraturefestival@gmail.com | +91 73065 54055
          </div>

          <div class="ftr">
            Department of Hadith and Related Sciences · Darul Huda Islamic University<br>
            HLF 2026 — Knowledge ✦ Culture ✦ Conversation
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px;" class="no-print">
          <button onclick="window.print()" style="padding: 10px 20px; font-weight: bold; cursor: pointer; border-radius: 99px; background: #d0021b; color: #fff; border: 0;">Print / Save as PDF</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
    }, 250);
  }

  // =============================================================
  // CONTRIBUTIONS & DONATIONS SYSTEM (SCREENSHOT & CUSTOM CONTRIBUTION)
  // =============================================================

  // Robust date formatter ensuring valid, elegant HLF date display
  function formatAcknowledgementDate(dateVal) {
    let d;
    if (!dateVal) {
      d = new Date();
    } else if (dateVal instanceof Date) {
      d = isNaN(dateVal.getTime()) ? new Date() : dateVal;
    } else {
      d = new Date(dateVal);
      if (isNaN(d.getTime())) {
        d = new Date();
      }
    }

    const day = d.getDate();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${day} ${month} ${year} · ${hours}:${minutes} ${ampm}`;
  }

  // 10. Inject Contribution Modal into Document
  function injectContributionModal() {
    if (document.getElementById('contrib-dialog')) return;

    const paymentCfg = (window.HLF_CONFIG && window.HLF_CONFIG.payment) || {
      fee: 50,
      upiId: 'hlf2026@dhiu',
      payeeName: 'Hadith Literature Festival DHIU',
      qrImagePath: ''
    };

    const dialog = document.createElement('dialog');
    dialog.id = 'contrib-dialog';
    dialog.className = 'reg-dialog glass';
    dialog.innerHTML = `
      <div class="reg-dialog-inner">
        <!-- Close Button -->
        <button type="button" class="reg-close-btn" id="contrib-close-x" aria-label="Close">×</button>

        <!-- STAGE 1: CONTRIBUTION FORM VIEW -->
        <div id="contrib-form-view">
          <div class="reg-dialog-header">
            <p class="tag"><b>[CONTRIBUTION]</b> ✦ HLF 2026</p>
            <h2 class="reg-title">Support the Festival</h2>
            <p class="reg-subtitle">Hadith Literature Festival · 18–20 October 2026 · Chemmad, Kerala</p>
            
            <div class="reg-fee-badge" style="background: linear-gradient(135deg, rgba(18, 144, 122, 0.15), rgba(47, 93, 147, 0.15)); border-color: var(--teal);">
              <span class="fee-label" id="contrib-tier-badge">TIER</span>
              <span class="fee-val" id="contrib-amount-badge" style="color: var(--teal);">₹786</span>
              <span class="fee-desc" id="contrib-desc-badge">Contribution</span>
            </div>
          </div>

          <form id="hlf-contrib-form" novalidate>
            <!-- SECTION 1: CONTRIBUTOR DETAILS -->
            <div class="reg-form-section">
              <h3 class="reg-section-title"><span class="step">1</span> Contributor Details</h3>
              
              <!-- Custom Contribution Amount Input (shown when Custom tier chosen) -->
              <div id="contrib-custom-amount-wrap" style="display: none; margin-bottom: 16px; background: rgba(18,144,122,0.06); border: 1.5px solid var(--teal); border-radius: 12px; padding: 14px;">
                <label class="reg-label" for="contrib-custom-amount-input" style="font-weight: 700; color: var(--teal);">Custom Contribution Amount (₹) <span class="req">*</span></label>
                <div style="position: relative; margin-top: 6px;">
                  <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-weight: 700; font-size: 1.2rem; color: var(--teal);">₹</span>
                  <input type="number" id="contrib-custom-amount-input" class="reg-input" placeholder="Enter amount (min ₹100)" min="100" step="1" style="padding-left: 36px; font-size: 1.15rem; font-weight: 700;">
                </div>
                <small style="color: var(--mute); font-size: 11px; display: block; margin-top: 6px;">Enter your desired contribution amount. Minimum ₹100. QR code updates automatically.</small>
              </div>

              <div class="reg-grid">
                <div class="reg-field reg-col-2">
                  <label class="reg-label" for="contrib-fullname">Full Name <span class="req">*</span></label>
                  <input type="text" id="contrib-fullname" class="reg-input" placeholder="e.g. Sayyid Ahmed" required autocomplete="name">
                </div>

                <div class="reg-field">
                  <label class="reg-label" for="contrib-mobile">Mobile Number <span class="req">*</span></label>
                  <input type="tel" id="contrib-mobile" class="reg-input" placeholder="10-digit mobile number" maxlength="10" required autocomplete="tel">
                </div>

                <div class="reg-field">
                  <label class="reg-label" for="contrib-email">Email Address <span class="opt">(Optional)</span></label>
                  <input type="email" id="contrib-email" class="reg-input" placeholder="name@example.com" autocomplete="email">
                </div>
              </div>
            </div>

            <!-- SECTION 2: UPI PAYMENT -->
            <div class="reg-form-section">
              <h3 class="reg-section-title"><span class="step">2</span> UPI Payment & Screenshot</h3>
              
              <div class="reg-pay-card">
                <div class="reg-qr-wrap">
                  <div class="reg-qr-box" id="contrib-qr-container">
                    <div id="contrib-qr-canvas"></div>
                    ${paymentCfg.qrImagePath ? `<img id="contrib-qr-img" src="${paymentCfg.qrImagePath}" alt="HLF UPI QR" style="display:none;" onerror="this.style.display='none'; document.getElementById('contrib-qr-canvas').style.display='block';">` : ''}
                  </div>
                  <span style="font-size: 11px; color: var(--mute);">Scan with any UPI App</span>
                </div>

                <div class="reg-pay-info">
                  <div class="upi-details">
                    <span class="upi-label">Contribution Amount</span>
                    <span style="font-size: 1.4rem; font-weight: 700; color: var(--teal);" id="contrib-pay-amount">₹786.00</span>
                  </div>
                  <div class="upi-details">
                    <span class="upi-label">UPI ID</span>
                    <span class="upi-val" id="contrib-upi-id-text">${paymentCfg.upiId}</span>
                  </div>
                  <div class="upi-details">
                    <span class="upi-label">Payee Name</span>
                    <span style="font-size: 13px; font-weight: 500; color: var(--ink);">${paymentCfg.payeeName}</span>
                  </div>

                  <div class="reg-pay-actions">
                    <button type="button" class="reg-btn-sm" id="contrib-copy-upi-btn">
                      <span>📋</span> <span id="contrib-copy-text">Copy UPI ID</span>
                    </button>
                    <a href="#" class="reg-btn-sm primary" id="contrib-pay-intent-btn" target="_blank" rel="noopener">
                      <span>⚡</span> <span id="contrib-intent-btn-text">Pay via UPI App</span>
                    </a>
                  </div>

                  <div class="reg-payment-notice">
                    <strong>How to complete your contribution:</strong><br>
                    1. Tap <strong>Pay via UPI App</strong> or scan the QR code using Google Pay, PhonePe, Paytm, BHIM, etc.<br>
                    2. Complete your payment of <strong id="contrib-notice-amount">₹786</strong>.<br>
                    3. Take a screenshot showing your completed payment receipt.<br>
                    4. Upload the screenshot below and complete your contribution.
                  </div>
                </div>
              </div>

              <!-- Payment Transaction Screenshot Upload -->
              <div class="reg-field" style="margin-top: 16px; margin-bottom: 14px;">
                <label class="reg-label">Payment Transaction Screenshot <span class="req">*</span></label>
                <p style="font-size: 11px; color: var(--mute); margin: 0 0 10px;">Upload a screenshot showing your completed UPI payment receipt.</p>
                
                <div class="reg-screenshot-zone" id="contrib-screenshot-zone">
                  <input type="file" id="contrib-screenshot-file" accept="image/jpeg,image/png,image/webp" style="display: none;">
                  <div id="contrib-screenshot-prompt">
                    <div style="font-size: 32px; margin-bottom: 6px;">📸</div>
                    <div style="font-size: 13px; font-weight: 600; color: var(--teal);">Click or drag & drop payment screenshot</div>
                    <div style="font-size: 11px; color: var(--mute); margin-top: 4px;">Supports JPG, PNG, WEBP (Max 5 MB)</div>
                  </div>
                  
                  <div id="contrib-screenshot-preview" style="display: none;" class="reg-screenshot-preview">
                    <img id="contrib-screenshot-preview-img" src="" alt="Payment Screenshot" class="reg-screenshot-thumb">
                    <div class="reg-screenshot-meta">
                      <div id="contrib-screenshot-filename" class="name">—</div>
                      <div id="contrib-screenshot-filesize" class="size">—</div>
                      <div style="display: flex; gap: 8px; margin-top: 6px;">
                        <button type="button" class="reg-btn-sm" id="contrib-screenshot-change-btn">Change</button>
                        <button type="button" class="reg-btn-sm danger" id="contrib-screenshot-remove-btn">Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Error Banner -->
            <div id="contrib-error-banner" class="reg-error-msg" role="alert"></div>

            <!-- Submit Button -->
            <button type="submit" id="contrib-submit-btn" class="btn p" style="width: 100%; justify-content: center; font-size: 1.05rem; padding: 16px;">
              <span id="contrib-submit-btn-text">Submit Contribution ✦</span>
            </button>
          </form>
        </div>

        <!-- STAGE 2: CONTRIBUTION ACKNOWLEDGEMENT VIEW -->
        <div id="contrib-success-view" class="contrib-ack-view" style="display: none;">
          <div class="contrib-ack-card">
            <!-- Header with HLF Branding -->
            <div class="contrib-ack-header">
              <div class="contrib-ack-logo">
                <span class="brand-text">HLF<span class="star">✦</span>2026</span>
                <span class="sub-text">HADITH LITERATURE FESTIVAL</span>
              </div>
              <div class="contrib-ack-title-badge">CONTRIBUTION ACKNOWLEDGEMENT</div>
              <div class="contrib-ack-venue">
                18–20 OCTOBER 2026<br>
                <span>Darul Huda Islamic University · Chemmad, Kerala</span>
              </div>
            </div>

            <div class="contrib-ack-divider"></div>

            <!-- With Gratitude Section -->
            <div class="contrib-ack-gratitude">
              <span class="gratitude-tag">WITH GRATITUDE</span>
              <h3 class="gratitude-name">Thank you, <span id="contrib-ack-name">—</span></h3>
              <p class="gratitude-desc">Your generous contribution supports the Hadith Literature Festival 2026.</p>
            </div>

            <div class="contrib-ack-divider"></div>

            <!-- Details Section -->
            <div class="contrib-ack-details">
              <span class="details-heading">CONTRIBUTION DETAILS</span>
              
              <div class="contrib-detail-row">
                <span class="detail-label">Contribution Type</span>
                <span class="detail-val" id="contrib-ack-type">—</span>
              </div>
              <div class="contrib-detail-row">
                <span class="detail-label">Contribution Amount</span>
                <span class="detail-val highlight" id="contrib-ack-amount">₹—</span>
              </div>
              <div class="contrib-detail-row">
                <span class="detail-label">Payment Method</span>
                <span class="detail-val">UPI</span>
              </div>
              <div class="contrib-detail-row">
                <span class="detail-label">Payment Proof</span>
                <span class="detail-val status-ok">Submitted ✓</span>
              </div>
              <div class="contrib-detail-row">
                <span class="detail-label">Submitted On</span>
                <span class="detail-val" id="contrib-ack-date">—</span>
              </div>
            </div>

            <div class="contrib-ack-divider"></div>

            <!-- Heartfelt Gratitude Note -->
            <div class="contrib-ack-note">
              <strong>WITH HEARTFELT GRATITUDE</strong>
              <p>Your support helps us create meaningful spaces for learning, scholarship and academic conversation.</p>
            </div>

            <div class="contrib-ack-footer">
              <p><strong>Department of Hadith and Related Sciences</strong><br>
              Darul Huda Islamic University · Chemmad, Kerala</p>
              <p class="contact-line">hadithliteraturefestival@gmail.com · +91 73065 54055</p>
            </div>
          </div>

          <div class="contrib-ack-actions">
            <button type="button" class="btn p" id="contrib-print-btn">🖨️ Print / Save Acknowledgement</button>
            <button type="button" class="btn" id="contrib-close-btn">Done / Return to Site</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Bind Dialog Events
    document.getElementById('contrib-close-x').onclick = closeContributionModal;
    document.getElementById('contrib-close-btn').onclick = closeContributionModal;
    document.getElementById('contrib-print-btn').onclick = printContributionConfirmation;

    // Close when clicking dialog backdrop
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                          rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        closeContributionModal();
      }
    });

    dialog.addEventListener('close', () => { document.body.style.overflow = ''; });
    dialog.addEventListener('cancel', () => { document.body.style.overflow = ''; });

    // Copy UPI ID button
    document.getElementById('contrib-copy-upi-btn').onclick = async () => {
      const upiId = (window.HLF_CONFIG && window.HLF_CONFIG.payment && window.HLF_CONFIG.payment.upiId) || 'hlf2026@dhiu';
      try {
        await navigator.clipboard.writeText(upiId);
        const copyTxt = document.getElementById('contrib-copy-text');
        copyTxt.textContent = 'Copied ✓';
        setTimeout(() => { copyTxt.textContent = 'Copy UPI ID'; }, 2000);
      } catch (err) {}
    };

    // Form submission
    document.getElementById('hlf-contrib-form').onsubmit = handleContributionSubmit;

    // Screenshot upload setup
    setupContributionScreenshotUpload();

    // Live update on custom amount input
    const customAmtInput = document.getElementById('contrib-custom-amount-input');
    if (customAmtInput) {
      customAmtInput.addEventListener('input', () => {
        if (!activeContributionData || !activeContributionData.isCustom) return;
        const raw = customAmtInput.value.trim();
        const num = Number(raw);
        if (raw && !isNaN(num) && num >= 100 && Number.isInteger(num)) {
          activeContributionData.amount = num;
          updateContributionUI(num, 'Custom Contribution', true);
          const err = document.getElementById('contrib-error-banner');
          if (err) { err.style.display = 'none'; err.textContent = ''; }
        } else {
          const amtBadge = document.getElementById('contrib-amount-badge');
          if (amtBadge) amtBadge.textContent = raw ? `₹${raw}` : '₹—';
        }
      });
    }
  }

  // Setup screenshot upload for contributions
  function setupContributionScreenshotUpload() {
    const zone = document.getElementById('contrib-screenshot-zone');
    const fileInput = document.getElementById('contrib-screenshot-file');
    const promptBox = document.getElementById('contrib-screenshot-prompt');
    const previewBox = document.getElementById('contrib-screenshot-preview');
    const previewImg = document.getElementById('contrib-screenshot-preview-img');
    const filenameEl = document.getElementById('contrib-screenshot-filename');
    const filesizeEl = document.getElementById('contrib-screenshot-filesize');
    const changeBtn = document.getElementById('contrib-screenshot-change-btn');
    const removeBtn = document.getElementById('contrib-screenshot-remove-btn');

    if (!zone || !fileInput) return;

    zone.onclick = (e) => {
      if (e.target.closest('#contrib-screenshot-remove-btn') || e.target.closest('#contrib-screenshot-change-btn')) {
        return;
      }
      fileInput.click();
    };

    if (changeBtn) {
      changeBtn.onclick = (e) => {
        e.stopPropagation();
        fileInput.click();
      };
    }

    if (removeBtn) {
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        resetContribScreenshot();
      };
    }

    zone.ondragover = (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    };
    zone.ondragleave = () => {
      zone.classList.remove('dragover');
    };
    zone.ondrop = (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processContribFile(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        processContribFile(e.target.files[0]);
      }
    };

    function processContribFile(file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        showContribError('Please upload a valid image file (JPG, PNG, or WEBP).');
        resetContribScreenshot();
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showContribError('Image file size exceeds 5 MB. Please select a smaller screenshot.');
        resetContribScreenshot();
        return;
      }

      const err = document.getElementById('contrib-error-banner');
      if (err) { err.style.display = 'none'; err.textContent = ''; }

      selectedContribScreenshotFile = file;

      const reader = new FileReader();
      reader.onload = (ev) => {
        previewImg.src = ev.target.result;
        filenameEl.textContent = file.name;
        filesizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        promptBox.style.display = 'none';
        previewBox.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    }
  }

  function resetContribScreenshot() {
    selectedContribScreenshotFile = null;
    const fileInput = document.getElementById('contrib-screenshot-file');
    const previewImg = document.getElementById('contrib-screenshot-preview-img');
    const filenameEl = document.getElementById('contrib-screenshot-filename');
    const filesizeEl = document.getElementById('contrib-screenshot-filesize');
    const previewBox = document.getElementById('contrib-screenshot-preview');
    const promptBox = document.getElementById('contrib-screenshot-prompt');

    if (fileInput) fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (filenameEl) filenameEl.textContent = '—';
    if (filesizeEl) filesizeEl.textContent = '—';
    if (previewBox) previewBox.style.display = 'none';
    if (promptBox) promptBox.style.display = 'block';
  }

  // 11. Connect all Contribution buttons
  function setupContributionButtons() {
    window.pay = (amount, label) => openContributionModal(amount, label);

    document.querySelectorAll('#tiers button, #sp button, .tier button').forEach(btn => {
      const origClick = btn.getAttribute('onclick');
      if (origClick && origClick.includes('pay(')) {
        btn.removeAttribute('onclick');
        btn.onclick = (e) => {
          e.preventDefault();
          const match = origClick.match(/pay\(\s*['"]?([a-zA-Z0-9]+)['"]?\s*,\s*['"]([^'"]+)['"]\s*\)/);
          if (match) {
            openContributionModal(match[1], match[2]);
          } else {
            const numMatch = origClick.match(/pay\(\s*(\d+)/);
            if (numMatch) openContributionModal(numMatch[1], 'Festival Contribution');
          }
        };
      }
    });
  }

  // Helper to update Contribution UI across modal
  function updateContributionUI(amount, tierName, isCustom) {
    const tierBadge = document.getElementById('contrib-tier-badge');
    const amountBadge = document.getElementById('contrib-amount-badge');
    const descBadge = document.getElementById('contrib-desc-badge');
    const payAmount = document.getElementById('contrib-pay-amount');
    const noticeAmount = document.getElementById('contrib-notice-amount');
    const intentBtnText = document.getElementById('contrib-intent-btn-text');
    const submitBtnText = document.getElementById('contrib-submit-btn-text');

    const formatted = Number(amount).toLocaleString('en-IN');
    const cleanTier = isCustom ? 'Custom' : (tierName || 'Festival Contribution');

    if (tierBadge) tierBadge.textContent = isCustom ? 'CUSTOM' : cleanTier.toUpperCase();
    if (amountBadge) amountBadge.textContent = `₹${formatted}`;
    if (descBadge) descBadge.textContent = isCustom ? 'Custom Contribution' : cleanTier;
    if (payAmount) payAmount.textContent = `₹${formatted}.00`;
    if (noticeAmount) noticeAmount.textContent = `₹${formatted}`;
    if (intentBtnText) intentBtnText.textContent = `Pay ₹${formatted} via UPI App`;
    if (submitBtnText) submitBtnText.textContent = `Submit Contribution (₹${formatted}) ✦`;

    renderContributionUpi(amount, cleanTier);
  }

  // 12. Open Contribution Modal
  function openContributionModal(amount, tierName) {
    const dialog = document.getElementById('contrib-dialog');
    if (!dialog) {
      injectContributionModal();
    }
    const d = document.getElementById('contrib-dialog');
    if (!d) return;

    const isCustom = amount === 'custom' || (tierName && tierName.toLowerCase().includes('custom'));
    const customWrap = document.getElementById('contrib-custom-amount-wrap');
    const customInput = document.getElementById('contrib-custom-amount-input');

    let currentAmount;
    let currentTier;

    if (isCustom) {
      currentTier = 'Custom Contribution';
      const existingVal = customInput ? Number(customInput.value) : 0;
      currentAmount = existingVal >= 100 ? existingVal : 100;
      if (customWrap) customWrap.style.display = 'block';
      if (customInput) {
        if (!customInput.value || Number(customInput.value) < 100) {
          customInput.value = '100';
        }
        customInput.required = true;
      }
    } else {
      currentTier = tierName || 'Festival Contribution';
      currentAmount = Number(amount) || 199;
      if (customWrap) customWrap.style.display = 'none';
      if (customInput) customInput.required = false;
    }

    activeContributionData = {
      amount: currentAmount,
      tierName: currentTier,
      isCustom: isCustom
    };

    updateContributionUI(currentAmount, currentTier, isCustom);
    resetContribScreenshot();

    // Reset views
    document.getElementById('contrib-form-view').style.display = 'block';
    document.getElementById('contrib-success-view').style.display = 'none';
    const err = document.getElementById('contrib-error-banner');
    if (err) { err.style.display = 'none'; err.textContent = ''; }

    // Lock page background scrolling
    document.body.style.overflow = 'hidden';

    if (typeof d.showModal === 'function') {
      d.showModal();
    } else {
      d.setAttribute('open', '');
    }

    if (isCustom && customInput) {
      setTimeout(() => customInput.focus(), 80);
    }
  }

  function closeContributionModal() {
    const dialog = document.getElementById('contrib-dialog');
    if (!dialog) return;

    document.body.style.overflow = '';
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  // 13. Render Contribution UPI Intent & QR
  function renderContributionUpi(amount, tierName) {
    const paymentCfg = (window.HLF_CONFIG && window.HLF_CONFIG.payment) || {
      upiId: 'hlf2026@dhiu',
      payeeName: 'Hadith Literature Festival DHIU'
    };

    const upiQuery = `pa=${encodeURIComponent(paymentCfg.upiId)}&pn=${encodeURIComponent(paymentCfg.payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('HLF Contribution - ' + tierName)}`;
    const upiIntentUrl = `upi://pay?${upiQuery}`;

    const intentBtn = document.getElementById('contrib-pay-intent-btn');
    if (intentBtn) {
      intentBtn.href = upiIntentUrl;
    }

    const upiTxt = document.getElementById('contrib-upi-id-text');
    if (upiTxt) {
      upiTxt.textContent = paymentCfg.upiId;
    }

    const qrCanvas = document.getElementById('contrib-qr-canvas');
    if (qrCanvas && window.QRCode) {
      qrCanvas.innerHTML = '';
      try {
        new window.QRCode(qrCanvas, {
          text: upiIntentUrl,
          width: 140,
          height: 140,
          colorDark: '#0b2a22',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } catch (e) {
        console.warn('QR code generation error:', e);
      }
    }
  }

  // 14. Handle Contribution Submit (Payment Screenshot & Custom Amount)
  async function handleContributionSubmit(e) {
    e.preventDefault();

    const errBanner = document.getElementById('contrib-error-banner');
    if (errBanner) { errBanner.style.display = 'none'; errBanner.textContent = ''; }

    const fullName = document.getElementById('contrib-fullname').value.trim();
    const mobile = document.getElementById('contrib-mobile').value.trim();
    const email = document.getElementById('contrib-email').value.trim();

    if (!activeContributionData) {
      showContribError('Please select a contribution tier.');
      return;
    }

    // Validation
    if (!fullName || fullName.length < 2) {
      showContribError('Please enter your full name (minimum 2 characters).');
      document.getElementById('contrib-fullname').focus();
      return;
    }

    const mobileClean = mobile.replace(/[\s-]/g, '');
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobileClean)) {
      showContribError('Please enter a valid 10-digit Indian mobile number.');
      document.getElementById('contrib-mobile').focus();
      return;
    }

    // Validate Custom Contribution Amount if custom
    let finalAmount = activeContributionData.amount;
    if (activeContributionData.isCustom) {
      const customInput = document.getElementById('contrib-custom-amount-input');
      const rawVal = customInput ? customInput.value.trim() : '';
      const numVal = Number(rawVal);

      if (!rawVal || isNaN(numVal) || numVal < 100 || !Number.isInteger(numVal)) {
        showContribError('Please enter a valid contribution amount (minimum ₹100).');
        if (customInput) customInput.focus();
        return;
      }
      finalAmount = numVal;
      activeContributionData.amount = finalAmount;
    }

    // Validate Payment Screenshot File
    if (!selectedContribScreenshotFile) {
      showContribError('Please upload your payment transaction screenshot before submitting your contribution.');
      return;
    }

    const submitBtn = document.getElementById('contrib-submit-btn');
    const origBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="reg-spinner"></span> Uploading Proof & Submitting...';

    try {
      const sb = window.getSupabase ? window.getSupabase() : null;
      if (!sb) {
        throw new Error('Supabase client could not be initialized. Please check network connection.');
      }

      // Step 1: Allocate contribution ID using RPC
      let contribId = null;
      try {
        const { data: allocData, error: allocErr } = await sb.rpc('allocate_contribution_id');
        if (!allocErr && allocData && allocData.contribution_id) {
          contribId = allocData.contribution_id;
        }
      } catch (allocEx) {
        console.warn('RPC allocate_contribution_id error:', allocEx);
      }

      if (!contribId) {
        contribId = 'HLFC-' + String(Math.floor(1000 + Math.random() * 9000));
      }

      // Step 2: Upload Screenshot to hlf-contribution-payment-proofs bucket (pure INSERT without upsert)
      const fileExt = (selectedContribScreenshotFile.name.split('.').pop() || 'png').toLowerCase();
      const fileTimestamp = Date.now();
      const filePath = `contributions/${contribId}/payment-proof-${fileTimestamp}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await sb.storage
        .from('hlf-contribution-payment-proofs')
        .upload(filePath, selectedContribScreenshotFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadErr) {
        console.error('Contribution screenshot upload error:', uploadErr);
        throw new Error('Payment screenshot upload failed: ' + uploadErr.message);
      }

      const { data: publicUrlData } = sb.storage.from('hlf-contribution-payment-proofs').getPublicUrl(filePath);
      const screenshotUrl = publicUrlData ? publicUrlData.publicUrl : null;

      // Step 3: Call submit_contribution RPC
      const tierName = activeContributionData.isCustom ? 'Custom' : activeContributionData.tierName;
      const { data, error } = await sb.rpc('submit_contribution', {
        p_full_name: fullName,
        p_mobile: mobileClean,
        p_amount: Number(finalAmount),
        p_contribution_type: tierName,
        p_payment_screenshot_path: filePath,
        p_payment_screenshot_url: screenshotUrl,
        p_contribution_id: contribId,
        p_email: email || null,
        p_transaction_id: null
      });

      if (error) {
        console.error('Contribution RPC error:', error);
        throw new Error('Contribution submission failed: ' + error.message);
      }

      if (!data || !data.success) {
        throw new Error('Unexpected response from contribution service.');
      }

      // Record contribution data internally
      activeContributionData = {
        contribution_id: data.contribution_id || contribId,
        full_name: data.full_name || fullName,
        amount: data.amount || finalAmount,
        contribution_type: data.contribution_type || tierName,
        mobile: mobileClean,
        payment_screenshot_path: filePath,
        payment_screenshot_url: screenshotUrl,
        payment_status: 'SUBMITTED',
        created_at: data.created_at || new Date().toISOString()
      };

      displayContributionSuccessView(activeContributionData);

    } catch (err) {
      console.error('Contribution submit error:', err);
      showContribError(err.message || 'An error occurred while submitting your contribution. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }

  function showContribError(msg) {
    const errBanner = document.getElementById('contrib-error-banner');
    if (errBanner) {
      errBanner.textContent = msg;
      errBanner.style.display = 'block';
      errBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // 15. Display Redesigned Official HLF Acknowledgement Screen
  function displayContributionSuccessView(data) {
    document.getElementById('contrib-form-view').style.display = 'none';
    document.getElementById('contrib-success-view').style.display = 'block';

    document.getElementById('contrib-ack-name').textContent = data.full_name;
    document.getElementById('contrib-ack-type').textContent = data.contribution_type;
    document.getElementById('contrib-ack-amount').textContent = `₹${Number(data.amount).toLocaleString('en-IN')}`;
    document.getElementById('contrib-ack-date').textContent = formatAcknowledgementDate(data.created_at);

    const inner = document.querySelector('#contrib-dialog .reg-dialog-inner');
    if (inner) inner.scrollTop = 0;
  }

  // 16. Printable Contribution Confirmation Receipt (Polished Official Festival Acknowledgement)
  function printContributionConfirmation() {
    if (!activeContributionData) return;
    const d = activeContributionData;
    const printDate = formatAcknowledgementDate(d.created_at);

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>HLF 2026 Contribution Acknowledgement - ${d.full_name}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap">
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Fira Code', monospace;
            padding: 30px;
            color: #17332d;
            background: #fff;
            max-width: 680px;
            margin: auto;
          }
          .ack-ticket {
            border: 2px solid #12907a;
            border-radius: 16px;
            padding: 36px;
            background: #fffefb;
            position: relative;
          }
          .ack-header {
            text-align: center;
            border-bottom: 2px solid #17332d;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .ack-logo-title {
            font-size: 26px;
            font-weight: 800;
            letter-spacing: 1px;
            color: #17332d;
          }
          .ack-logo-title span { color: #d0021b; }
          .ack-logo-sub {
            display: block;
            font-size: 11px;
            letter-spacing: 3px;
            text-transform: uppercase;
            color: #4b625b;
            margin-top: 4px;
          }
          .ack-badge {
            display: inline-block;
            background: #12907a;
            color: #fff;
            padding: 6px 18px;
            border-radius: 99px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
            margin: 14px 0 8px;
          }
          .ack-dates {
            font-size: 12px;
            color: #4b625b;
            line-height: 1.4;
          }
          .ack-section {
            margin: 22px 0;
            padding: 16px 0;
            border-bottom: 1px solid rgba(23, 51, 45, 0.12);
          }
          .ack-tag {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 2px;
            color: #12907a;
            text-transform: uppercase;
            display: block;
            margin-bottom: 6px;
          }
          .ack-name {
            font-size: 20px;
            font-weight: 700;
            color: #17332d;
            margin: 0 0 6px;
          }
          .ack-desc {
            font-size: 13px;
            color: #4b625b;
            margin: 0;
            line-height: 1.5;
          }
          .ack-table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
          }
          .ack-table td {
            padding: 10px 4px;
            border-bottom: 1px dashed rgba(23, 51, 45, 0.15);
            font-size: 13px;
          }
          .ack-table td.lbl {
            color: #4b625b;
            width: 44%;
          }
          .ack-table td.val {
            font-weight: 600;
            color: #17332d;
          }
          .ack-table td.val.amount {
            color: #12907a;
            font-size: 18px;
            font-weight: 800;
          }
          .ack-table td.val.status {
            color: #12907a;
          }
          .ack-gratitude-box {
            background: rgba(18, 144, 122, 0.08);
            border-left: 4px solid #12907a;
            padding: 14px 18px;
            border-radius: 6px;
            margin: 20px 0;
            font-size: 12px;
            line-height: 1.6;
            color: #17332d;
          }
          .ack-footer {
            text-align: center;
            font-size: 11px;
            color: #4b625b;
            margin-top: 24px;
            line-height: 1.6;
          }
          .ack-footer strong {
            color: #17332d;
          }
          @media print {
            body { padding: 0; background: none; }
            .no-print { display: none !important; }
            .ack-ticket { border-color: #17332d; }
          }
        </style>
      </head>
      <body>
        <div class="ack-ticket">
          <div class="ack-header">
            <div class="ack-logo-title">HLF<span>✦</span>2026</div>
            <span class="ack-logo-sub">Hadith Literature Festival</span>
            <div><span class="ack-badge">CONTRIBUTION ACKNOWLEDGEMENT</span></div>
            <div class="ack-dates">
              <strong>18–20 OCTOBER 2026</strong><br>
              Darul Huda Islamic University · Chemmad, Kerala
            </div>
          </div>

          <div class="ack-section">
            <span class="ack-tag">WITH GRATITUDE</span>
            <h2 class="ack-name">Thank you, ${d.full_name}</h2>
            <p class="ack-desc">Your generous contribution supports the Hadith Literature Festival 2026.</p>
          </div>

          <table class="ack-table">
            <tr>
              <td class="lbl">Contribution Type:</td>
              <td class="val">${d.contribution_type}</td>
            </tr>
            <tr>
              <td class="lbl">Contribution Amount:</td>
              <td class="val amount">₹${Number(d.amount).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td class="lbl">Payment Method:</td>
              <td class="val">UPI</td>
            </tr>
            <tr>
              <td class="lbl">Payment Proof:</td>
              <td class="val status">Submitted ✓</td>
            </tr>
            <tr>
              <td class="lbl">Submitted On:</td>
              <td class="val">${printDate}</td>
            </tr>
          </table>

          <div class="ack-gratitude-box">
            <strong style="color: #12907a; letter-spacing: 1px; display: block; margin-bottom: 4px;">WITH HEARTFELT GRATITUDE</strong>
            Your support helps us create meaningful spaces for learning, scholarship and academic conversation at Darul Huda Islamic University.
          </div>

          <div class="ack-footer">
            <strong>Department of Hadith and Related Sciences</strong><br>
            Darul Huda Islamic University · Chemmad, Kerala<br>
            hadithliteraturefestival@gmail.com · +91 73065 54055
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px;" class="no-print">
          <button onclick="window.print()" style="padding: 12px 28px; font-weight: bold; font-family: 'Fira Code', monospace; cursor: pointer; border-radius: 99px; background: #12907a; color: #fff; border: 0; font-size: 14px; box-shadow: 0 4px 12px rgba(18,144,122,0.3);">🖨️ Print / Save as PDF</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
    }, 250);
  }

  // 17. Dynamic Data Sync with Supabase (Featured Image, Gallery, Poster, Schedule, Updates, Settings)
  async function loadSupabaseData() {
    try {
      const sb = window.getSupabase ? window.getSupabase() : null;
      if (!sb) return;

      // A. Dynamic Featured Image & Public Gallery Sync
      try {
        // 1. Featured image for Landing Page
        const { data: featuredData } = await sb.from('gallery_items')
          .select('*')
          .eq('published', true)
          .eq('featured', true)
          .limit(1);

        if (featuredData && featuredData.length > 0 && featuredData[0].image_url) {
          const featUrl = featuredData[0].image_url;
          const pst = document.querySelector('.pst');
          const hbg = document.querySelector('.hbg');
          if (pst) pst.src = featUrl;
          if (hbg) hbg.style.backgroundImage = 'url(' + featUrl + ')';
        } else {
          // Fallback to active poster
          const { data: posterData } = await sb.from('posters').select('*').eq('is_active', true).limit(1);
          if (posterData && posterData.length > 0 && posterData[0].image_url) {
            const pUrl = posterData[0].image_url;
            const pst = document.querySelector('.pst');
            const hbg = document.querySelector('.hbg');
            if (pst) pst.src = pUrl;
            if (hbg) hbg.style.backgroundImage = 'url(' + pUrl + ')';
          }
        }

        // 2. Published Gallery items for Public Gallery Section
        const { data: galleryData } = await sb.from('gallery_items')
          .select('*')
          .eq('published', true)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (galleryData && galleryData.length > 0 && typeof window.MEDIA !== 'undefined') {
          const dynMedia = galleryData.map(item => ({
            type: 'image',
            src: item.image_url,
            cat: item.category || 'Events',
            title: item.title,
            desc: item.description || '',
            span: item.featured ? 2 : 1
          }));

          // Replace in-memory MEDIA
          window.MEDIA.splice(0, window.MEDIA.length, ...dynMedia);

          // Update gallery category chips and re-render
          const categories = ['All', 'Events', 'Sessions', 'Guests', 'Moments'];
          const gchipsEl = document.getElementById('gchips');
          if (gchipsEl && typeof window.chips === 'function' && typeof window.gal === 'function') {
            window.chips(gchipsEl, categories, window.gal);
            window.gal('All');
          }
        }
      } catch (err) {
        console.warn('Could not sync dynamic gallery:', err);
      }

      // B. Dynamic Schedule Items
      try {
        const { data: progData } = await sb.from('programme_items')
          .select('*')
          .eq('status', 'scheduled')
          .order('day_number', { ascending: true })
          .order('sort_order', { ascending: true });

        if (progData && progData.length > 0 && typeof window.SCHEDULE !== 'undefined') {
          const dayMap = {};
          progData.forEach(item => {
            const dayNum = item.day_number || 1;
            if (!dayMap[dayNum]) {
              const defaultDate = dayNum === 1 ? '18 October 2026' : dayNum === 2 ? '19 October 2026' : '20 October 2026';
              dayMap[dayNum] = {
                date: item.date || defaultDate,
                items: []
              };
            }
            const timeStr = (item.start_time || '') + (item.end_time ? ' – ' + item.end_time : '');
            let descStr = '';
            if (item.speaker) descStr += '✦ ' + item.speaker + ' | ';
            if (item.venue) descStr += '📍 ' + item.venue + ' — ';
            if (item.description) descStr += item.description;

            dayMap[dayNum].items.push({
              time: timeStr,
              title: item.title,
              desc: descStr
            });
          });

          const dynSchedule = Object.keys(dayMap).sort((a,b)=>a-b).map(k => dayMap[k]);
          if (dynSchedule.length > 0) {
            window.SCHEDULE.splice(0, window.SCHEDULE.length, ...dynSchedule);
            if (typeof window.sched === 'function') {
              window.sched();
            }
          }
        }
      } catch (err) {
        console.warn('Could not sync dynamic schedule:', err);
      }

      // C. Dynamic Event Updates
      try {
        const { data: updateData } = await sb.from('event_updates')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (updateData && updateData.length > 0 && typeof window.POSTS !== 'undefined') {
          const colors = ["--red", "--teal", "--amb", "--yel", "--blue", "--grn"];
          const dynPosts = updateData.map((u, i) => ({
            cat: u.category || "Update",
            title: u.title,
            text: u.description,
            date: u.date,
            c: colors[i % colors.length],
            wide: i === 0 ? 1 : 0,
            img: u.image_url ? null : (i === 0 ? "poster" : null)
          }));
          window.POSTS.splice(0, window.POSTS.length, ...dynPosts);
          const cats = ["All", ...new Set(window.POSTS.map(p => p.cat))];
          const chipsEl = document.getElementById('chips');
          if (chipsEl && typeof window.chips === 'function' && typeof window.feed === 'function') {
            window.chips(chipsEl, cats, window.feed);
            window.feed("All");
          }
        }
      } catch (err) {
        console.warn('Could not sync event updates:', err);
      }

      // D. Dynamic Festival Settings
      try {
        const { data: settingsData } = await sb.from('festival_settings').select('*').eq('id', 'general').single();
        if (settingsData && window.HLF_CONFIG) {
          if (settingsData.upi_id) window.HLF_CONFIG.payment.upiId = settingsData.upi_id;
          if (settingsData.upi_payee_name) window.HLF_CONFIG.payment.payeeName = settingsData.upi_payee_name;
          if (settingsData.upi_qr_image_url) window.HLF_CONFIG.payment.qrImagePath = settingsData.upi_qr_image_url;
          renderUpiPaymentControls(activeRegistrationData ? activeRegistrationData.registration_id : null);
        }
      } catch (err) {
        console.warn('Could not sync festival settings:', err);
      }

    } catch (globalErr) {
      console.warn('Supabase global sync error:', globalErr);
    }
  }

  // Expose helpers globally
  window.openRegistrationModal = openRegistrationModal;
  window.closeRegistrationModal = closeRegistrationModal;
  window.openContributionModal = openContributionModal;
  window.closeContributionModal = closeContributionModal;
  window.loadSupabaseData = loadSupabaseData;
  window.bootHLFInteractions = bootHLFInteractions;

  // Delegated click handler: Guaranteed to intercept all .reg clicks anywhere in document
  document.addEventListener('click', function (e) {
    const registerButton = e.target.closest('.reg');
    if (!registerButton) return;

    e.preventDefault();
    e.stopPropagation();

    if (typeof window.openRegistrationModal === 'function') {
      window.openRegistrationModal();
    } else {
      console.error('HLF registration handler unavailable');
    }
  });

  // URL Hash change listener
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#register') {
      openRegistrationModal();
    }
  });

  // Safe DOM ready bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootHLFInteractions, { once: true });
  } else {
    bootHLFInteractions();
  }
})();
