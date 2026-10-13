/**
 * HLF 2026 — Quiz Competition Registration System
 * Modal Dialog Controller & Supabase RPC Client
 */

(function () {
  'use strict';

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

  let lastRegisteredData = null;

  // Initialize once DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuizSystem);
  } else {
    initQuizSystem();
  }

  function initQuizSystem() {
    setupModalEvents();
    setupInstitutionCombobox();
    setupFormSubmission();
    setupSuccessActions();
    setupTriggerLinks();
    checkUrlHash();
  }

  // 1. Open / Close Modal Logic
  function openQuizModal() {
    const dialog = document.getElementById('quiz-dialog');
    if (!dialog) return;

    // Lock page background scrolling
    document.body.style.overflow = 'hidden';

    // Reset error banner
    clearError();

    // Show form view by default unless already submitted in this session
    const formView = document.getElementById('quiz-form-view');
    const successView = document.getElementById('quiz-success-view');
    if (formView && successView) {
      if (!lastRegisteredData) {
        formView.style.display = 'block';
        successView.style.display = 'none';
      }
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    // Scroll dialog content to top
    const inner = dialog.querySelector('.reg-dialog-inner');
    if (inner) inner.scrollTop = 0;
  }

  function closeQuizModal() {
    const dialog = document.getElementById('quiz-dialog');
    if (!dialog) return;

    // Restore background scrolling
    document.body.style.overflow = '';

    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }

    // Clean hash without page jump or reload
    if (window.location.hash === '#quiz') {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) {}
    }
  }

  // 2. Setup Dialog Core Listeners
  function setupModalEvents() {
    const dialog = document.getElementById('quiz-dialog');
    if (!dialog) return;

    // Close button (X)
    const closeBtn = document.getElementById('quiz-close-x');
    if (closeBtn) {
      closeBtn.onclick = closeQuizModal;
    }

    // Done button in success view
    const doneBtn = document.getElementById('quiz-done-btn');
    if (doneBtn) {
      doneBtn.onclick = closeQuizModal;
    }

    // Close when clicking dialog backdrop
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        closeQuizModal();
      }
    });

    // Native cancel / close event listeners to guarantee body scroll restoration
    dialog.addEventListener('cancel', () => {
      document.body.style.overflow = '';
      if (window.location.hash === '#quiz') {
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
      }
    });
    dialog.addEventListener('close', () => {
      document.body.style.overflow = '';
    });
  }

  // 3. Setup Institution Searchable Combobox
  function setupInstitutionCombobox() {
    const combobox = document.getElementById('quiz-inst-combobox');
    const searchInput = document.getElementById('quiz-inst-search');
    const toggleBtn = document.getElementById('quiz-inst-toggle-btn');
    const dropdown = document.getElementById('quiz-inst-dropdown');
    const list = document.getElementById('quiz-inst-options-list');
    const hiddenInput = document.getElementById('quiz-institution');
    const otherGroup = document.getElementById('quiz-other-inst-group');
    const otherInput = document.getElementById('quiz-other-inst');

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
    }

    function selectItem(val) {
      hiddenInput.value = val;
      searchInput.value = val;
      closeDropdown();

      if (val === 'Other') {
        if (otherGroup) otherGroup.style.display = 'block';
        if (otherInput) {
          otherInput.required = true;
          otherInput.focus();
        }
      } else {
        if (otherGroup) otherGroup.style.display = 'none';
        if (otherInput) {
          otherInput.required = false;
          otherInput.value = '';
        }
      }
    }

    searchInput.addEventListener('focus', openDropdown);
    searchInput.addEventListener('click', openDropdown);
    searchInput.addEventListener('input', (e) => {
      openDropdown();
      renderList(e.target.value);
      if (hiddenInput.value !== 'Other') {
        hiddenInput.value = '';
      }
    });

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
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
      if (dropdown.style.display !== 'block' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        openDropdown();
        return;
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

    document.addEventListener('click', (e) => {
      if (!combobox.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  // 4. Form Validation & Supabase Submission
  function setupFormSubmission() {
    const form = document.getElementById('quiz-registration-form');
    if (!form) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      clearError();

      const fullName = (document.getElementById('quiz-fullname')?.value || '').trim();
      const mobile = (document.getElementById('quiz-mobile')?.value || '').trim();
      const email = (document.getElementById('quiz-email')?.value || '').trim();
      const selectedInst = (document.getElementById('quiz-institution')?.value || '').trim();
      const otherInst = (document.getElementById('quiz-other-inst')?.value || '').trim();
      const course = (document.getElementById('quiz-course')?.value || '').trim();
      const department = (document.getElementById('quiz-department')?.value || '').trim();
      const district = (document.getElementById('quiz-district')?.value || '').trim();
      const notes = (document.getElementById('quiz-notes')?.value || '').trim();
      const consent = document.getElementById('quiz-consent')?.checked;

      // Validate Name
      if (!fullName || fullName.length < 2) {
        showError('Please enter your full name (minimum 2 characters).');
        document.getElementById('quiz-fullname')?.focus();
        return;
      }

      // Validate Mobile (10 Indian digits)
      const cleanMobile = mobile.replace(/\D/g, '');
      const validMobile = /^[6-9]\d{9}$/.test(cleanMobile.length > 10 ? cleanMobile.slice(-10) : cleanMobile);
      if (!validMobile) {
        showError('Please enter a valid 10-digit Indian mobile number (e.g. 9847123456).');
        document.getElementById('quiz-mobile')?.focus();
        return;
      }

      // Validate Email (if provided)
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('Please enter a valid email address, or leave it blank.');
        document.getElementById('quiz-email')?.focus();
        return;
      }

      // Validate Institution
      if (!selectedInst) {
        showError('Please search and select your college or institution from the list.');
        document.getElementById('quiz-inst-search')?.focus();
        return;
      }

      let finalInstitution = selectedInst;
      if (selectedInst === 'Other') {
        if (!otherInst || otherInst.length < 2) {
          showError('Please type the name of your college or institution.');
          document.getElementById('quiz-other-inst')?.focus();
          return;
        }
        finalInstitution = otherInst;
      }

      if (!consent) {
        showError('Please confirm the checkbox to agree to participate.');
        document.getElementById('quiz-consent')?.focus();
        return;
      }

      // Loading state
      const submitBtn = document.getElementById('quiz-submit-btn');
      const origBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="reg-spinner"></span> Submitting registration...`;

      try {
        const sb = window.getSupabase ? window.getSupabase() : null;
        if (!sb) {
          throw new Error('Supabase client could not be loaded. Please check your network connection.');
        }

        const { data, error } = await sb.rpc('submit_quiz_registration', {
          p_full_name: fullName,
          p_mobile: cleanMobile.length > 10 ? cleanMobile.slice(-10) : cleanMobile,
          p_institution: finalInstitution,
          p_email: email || null,
          p_course: course || null,
          p_department: department || null,
          p_district: district || null,
          p_notes: notes || null
        });

        if (error) {
          console.error('Quiz registration error:', error);
          throw new Error(error.message || 'Could not submit quiz registration.');
        }

        if (!data || !data.success) {
          throw new Error('Unexpected response from registration service.');
        }

        lastRegisteredData = data;
        displaySuccessScreen(data);

      } catch (err) {
        showError(err.message || 'An error occurred during submission. Please try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    };
  }

  // 5. Success Screen Display
  function displaySuccessScreen(data) {
    const formView = document.getElementById('quiz-form-view');
    const successView = document.getElementById('quiz-success-view');
    if (!formView || !successView) return;

    formView.style.display = 'none';
    successView.style.display = 'block';

    const refEl = document.getElementById('quiz-success-ref');
    const nameEl = document.getElementById('quiz-success-name');
    const mobileEl = document.getElementById('quiz-success-mobile');
    const instEl = document.getElementById('quiz-success-inst');
    const subtitleEl = document.getElementById('quiz-success-subtitle');
    const statusBadge = document.getElementById('quiz-success-status-badge');

    if (refEl) refEl.textContent = data.quiz_ref || 'HLF26-QUIZ-XXXX';
    if (nameEl) nameEl.textContent = data.full_name || '—';
    if (mobileEl) mobileEl.textContent = data.mobile || '—';
    if (instEl) instEl.textContent = data.institution || '—';

    if (data.is_duplicate) {
      if (subtitleEl) subtitleEl.innerHTML = `<strong>Note:</strong> You were already registered! Here is your saved Quiz Reference ID.`;
      if (statusBadge) {
        statusBadge.textContent = 'Existing Registration · Free Entry';
        statusBadge.className = 'reg-status-pill pending';
      }
    } else {
      if (subtitleEl) subtitleEl.textContent = 'Your entry for the HLF 2026 Hadith Live Quiz Competition has been confirmed.';
      if (statusBadge) {
        statusBadge.textContent = 'Registered · Free Entry';
        statusBadge.className = 'reg-status-pill verified';
      }
    }

    // Scroll dialog content to top of success card
    const inner = document.querySelector('#quiz-dialog .reg-dialog-inner');
    if (inner) inner.scrollTop = 0;
  }

  // 6. Success Actions: Copy, Print Pass
  function setupSuccessActions() {
    const copyBtn = document.getElementById('quiz-copy-ref-btn');
    const feedback = document.getElementById('quiz-copy-feedback');

    if (copyBtn) {
      copyBtn.onclick = () => {
        const ref = document.getElementById('quiz-success-ref')?.textContent || '';
        if (!ref) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ref).then(showCopyFeedback).catch(() => fallbackCopy(ref));
        } else {
          fallbackCopy(ref);
        }
      };
    }

    function fallbackCopy(text) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showCopyFeedback();
      } catch (e) {
        alert('Quiz Reference: ' + text);
      }
    }

    function showCopyFeedback() {
      if (!feedback) return;
      feedback.style.display = 'inline';
      setTimeout(() => {
        feedback.style.display = 'none';
      }, 3000);
    }

    // Print / Download Pass
    const printBtn = document.getElementById('quiz-print-btn');
    if (printBtn) {
      printBtn.onclick = printQuizPass;
    }
  }

  function printQuizPass() {
    const data = lastRegisteredData || {};
    const ref = data.quiz_ref || document.getElementById('quiz-success-ref')?.textContent || 'HLF26-QUIZ-XXXX';
    const name = data.full_name || document.getElementById('quiz-success-name')?.textContent || 'Participant';
    const inst = data.institution || document.getElementById('quiz-success-inst')?.textContent || '—';
    const mobile = data.mobile || document.getElementById('quiz-success-mobile')?.textContent || '—';
    const printDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const printWindow = window.open('', '_blank', 'width=760,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>HLF 2026 Quiz Pass — ${ref}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            background: #fbf7d6;
            color: #17332d;
            padding: 40px 20px;
            display: flex;
            justify-content: center;
          }
          .pass-card {
            max-width: 650px;
            width: 100%;
            background: #ffffff;
            border: 2px solid #12907a;
            border-radius: 16px;
            padding: 36px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          }
          .pass-header {
            text-align: center;
            border-bottom: 2px dashed #12907a;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .pass-title { font-size: 24px; font-weight: 700; color: #17332d; letter-spacing: 1px; }
          .pass-sub { font-size: 13px; color: #4b625b; margin-top: 4px; }
          .badge {
            display: inline-block;
            background: #12907a;
            color: #fff;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            margin-top: 10px;
          }
          .ref-box {
            text-align: center;
            background: #f0eeb6;
            border: 2px dashed #17332d;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
          }
          .ref-label { font-size: 11px; color: #4b625b; letter-spacing: 2px; }
          .ref-val { font-size: 28px; font-weight: 700; color: #d0021b; margin-top: 4px; }
          .pass-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .pass-table td { padding: 8px 4px; border-bottom: 1px solid #e0dec0; font-size: 14px; }
          .pass-table td.lbl { color: #4b625b; width: 40%; }
          .pass-table td.val { font-weight: 600; text-align: right; color: #17332d; }
          .instructions {
            background: #f9f9f5;
            border-left: 4px solid #12907a;
            padding: 14px;
            font-size: 12px;
            color: #17332d;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .footer { text-align: center; font-size: 11px; color: #4b625b; border-top: 1px solid #e0dec0; padding-top: 14px; }
          @media print {
            body { background: #fff; padding: 0; }
            .pass-card { box-shadow: none; border: 2px solid #000; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="pass-card">
          <div class="pass-header">
            <h1 class="pass-title">HADITH LITERATURE FESTIVAL 2026</h1>
            <p class="pass-sub">Live Quiz Programme · Day 3 (20 October 2026)</p>
            <span class="badge">OFFICIAL ENTRY PASS · FREE REGISTRATION</span>
          </div>

          <div class="ref-box">
            <div class="ref-label">QUIZ REFERENCE ID</div>
            <div class="ref-val">${escapeHtml(ref)}</div>
          </div>

          <table class="pass-table">
            <tr><td class="lbl">Participant Name:</td><td class="val">${escapeHtml(name)}</td></tr>
            <tr><td class="lbl">College / Institution:</td><td class="val">${escapeHtml(inst)}</td></tr>
            <tr><td class="lbl">WhatsApp Number:</td><td class="val">${escapeHtml(mobile)}</td></tr>
            <tr><td class="lbl">Competition Date:</td><td class="val">20 October 2026 (2:00 PM – 5:00 PM)</td></tr>
            <tr><td class="lbl">Reporting Venue:</td><td class="val">Darul Hikma, Chemmad</td></tr>
            <tr><td class="lbl">Issued On:</td><td class="val">${printDate}</td></tr>
          </table>

          <div class="instructions">
            <strong>Important Instructions:</strong><br>
            • Report at Darul Hikma by 1:30 PM with your institutional ID card.<br>
            • Present this reference pass at the registration desk.<br>
            • For inquiries, contact: hadithliteraturefestival@gmail.com
          </div>

          <div class="footer">
            Department of Hadith and Related Sciences · Darul Huda Islamic University, Chemmad, Kerala
          </div>

          <div class="no-print" style="text-align:center;margin-top:20px;">
            <button onclick="window.print()" style="padding:10px 24px;background:#12907a;color:#fff;border:none;border-radius:99px;font-weight:bold;cursor:pointer;">🖨️ Print Pass</button>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
    }, 250);
  }

  // 7. Setup Trigger Links & Delegated Handlers
  function setupTriggerLinks() {
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.nav-quiz, .hero-quiz-btn, .quiz-banner-cta, a[href="#quiz"]');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        openQuizModal();
      }
    });

    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#quiz') {
        openQuizModal();
      }
    });
  }

  function checkUrlHash() {
    if (window.location.hash === '#quiz') {
      setTimeout(() => {
        try { openQuizModal(); } catch (err) {}
      }, 150);
    }
  }

  // Helpers
  function showError(msg) {
    const el = document.getElementById('quiz-error-banner');
    if (!el) return;
    el.textContent = '⚠️ ' + msg;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearError() {
    const el = document.getElementById('quiz-error-banner');
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
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

  // Expose global methods
  window.openQuizModal = openQuizModal;
  window.closeQuizModal = closeQuizModal;
  window.HLF_QUIZ = {
    HLF_INSTITUTIONS,
    openQuizModal,
    closeQuizModal,
    displaySuccessScreen,
    showError,
    clearError
  };

})();
