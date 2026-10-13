/**
 * HLF 2026 — Admin Portal Application Logic
 * Powered by Supabase Authentication, Database, and Storage
 */

(function () {
  let currentUser = null;
  let allRegistrations = [];
  let allGalleryItems = [];
  let allPosters = [];
  let allUpdates = [];
  let allAnnouncements = [];
  let allProgramme = [];
  let selectedRegistration = null;
  let allContributions = [];
  let selectedContribution = null;
  let contribToDelete = null;
  let currentContributionTarget = 50000;
  let allQuizRegistrations = [];
  let selectedQuizRegistration = null;

  document.addEventListener('DOMContentLoaded', initAdmin);

  async function initAdmin() {
    setupTheme();
    setupNavigation();
    setupAuthListeners();
    setupContributionTargetForm();
    setupQuizListeners();
    checkInitialAdminStatus();
  }

  // 1. Theme Setup
  function setupTheme() {
    try {
      const saved = localStorage.getItem('hlf-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = saved;
    } catch (e) { }

    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('hlf-theme', next); } catch (e) { }
      };
    }
  }

  // 2. Navigation Tabs
  function setupNavigation() {
    document.querySelectorAll('.nav-item button').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      };
    });

    document.getElementById('global-refresh-btn').onclick = () => {
      loadAllAdminData();
      showToast('Data refreshed successfully');
    };

    document.getElementById('logout-btn').onclick = handleLogout;
  }

  function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.querySelector('button').dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.style.display = pane.id === `pane-${tabId}` ? 'block' : 'none';
    });

    const headings = {
      dashboard: 'Dashboard Overview',
      registrations: 'Registration Management',
      quiz: 'Quiz Competition Management',
      contributions: 'Contributions & Donations Management',
      gallery: 'Gallery Management',
      posters: 'Poster Management',
      updates: 'Event Updates & Journal',
      announcements: 'Announcements & Alerts',
      programme: 'Programme & Schedule',
      branding: 'Site Images & Branding',
      settings: 'Festival & System Settings'
    };
    document.getElementById('page-heading').textContent = headings[tabId] || 'Admin Console';
  }
  window.switchTab = switchTab;

  // 3. Supabase Authentication
  function setupAuthListeners() {
    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) {
      showAuthError('Supabase client could not be initialized.');
      return;
    }

    // Auth State Observer
    sb.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        verifyAdminAccess(session.user);
      } else {
        showAuthScreen();
      }
    });

    // Form handlers
    document.getElementById('admin-login-form').onsubmit = handleLoginSubmit;
    document.getElementById('claim-admin-form').onsubmit = handleClaimAdminSubmit;
  }

  async function checkInitialAdminStatus() {
    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) return;

    try {
      const { data: needed, error } = await sb.rpc('check_admin_setup_needed');
      if (!error && needed === true) {
        document.getElementById('first-admin-setup-box').style.display = 'block';
      }
    } catch (e) {
      console.warn('Could not check admin setup status:', e);
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    hideAuthError();

    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-pass').value;
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.textContent = 'Verifying credentials...';

    const sb = window.getSupabase();
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data && data.user) {
        await verifyAdminAccess(data.user);
      }
    } catch (err) {
      showAuthError(err.message || 'Login failed. Please check your email and password.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In to Admin Portal';
    }
  }

  async function handleClaimAdminSubmit(e) {
    e.preventDefault();
    hideAuthError();

    const email = document.getElementById('setup-email').value.trim();
    const password = document.getElementById('setup-pass').value;

    const sb = window.getSupabase();
    try {
      // 1. Sign up the user
      const { data: signUpData, error: signUpErr } = await sb.auth.signUp({
        email,
        password
      });
      if (signUpErr) throw signUpErr;

      // 2. Sign in if needed
      if (!signUpData.session) {
        const { error: signInErr } = await sb.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      }

      // 3. Claim the first admin slot
      const { data: claimData, error: claimErr } = await sb.rpc('claim_first_admin');
      if (claimErr) throw claimErr;

      showToast('Super Admin access claimed successfully!');
      document.getElementById('first-admin-setup-box').style.display = 'none';

      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        await verifyAdminAccess(user);
      }
    } catch (err) {
      showAuthError(err.message || 'Could not claim admin account. It may already be initialized.');
    }
  }

  async function verifyAdminAccess(user) {
    const sb = window.getSupabase();
    try {
      // Check if user ID or email is in admin_users table
      let { data, error } = await sb.from('admin_users').select('*').eq('id', user.id).maybeSingle();

      if (!data && user.email) {
        const { data: byEmail } = await sb.from('admin_users').select('*').ilike('email', user.email.trim()).maybeSingle();
        if (byEmail) {
          data = byEmail;
        }
      }

      if (error || !data) {
        // Not an authorized admin
        await sb.auth.signOut();
        showAuthError('Access Denied: Your account is not authorized as an HLF administrator.');
        showAuthScreen();
        return;
      }

      // Authorized!
      currentUser = user;
      document.getElementById('current-user-display').textContent = user.email || 'Admin';
      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('admin-app').style.display = 'flex';

      loadAllAdminData();
    } catch (err) {
      console.error('Admin verification error:', err);
      showAuthError('Verification error. Please contact technical team.');
    }
  }

  async function handleLogout() {
    const sb = window.getSupabase();
    await sb.auth.signOut();
    currentUser = null;
    showAuthScreen();
    showToast('Logged out successfully');
  }

  function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'grid';
    document.getElementById('admin-app').style.display = 'none';
  }

  function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideAuthError() {
    const el = document.getElementById('auth-error');
    el.textContent = '';
    el.style.display = 'none';
  }

  // 4. Data Loading
  async function loadAllAdminData() {
    await Promise.all([
      loadRegistrations(),
      loadQuizRegistrations(),
      loadContributions(),
      loadGallery(),
      loadPosters(),
      loadUpdates(),
      loadAnnouncements(),
      loadProgramme(),
      loadSettings(),
      loadSiteBranding()
    ]);
  }

  // -------------------------------------------------------------
  // REGISTRATIONS MANAGEMENT
  // -------------------------------------------------------------
  async function loadRegistrations() {
    const sb = window.getSupabase();
    try {
      const { data, error } = await sb.from('registrations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allRegistrations = data || [];

      updateDashboardCards();
      renderRegistrationsTable();
      renderRecentRegistrations();
    } catch (err) {
      console.error('Failed to load registrations:', err);
      showToast('Error loading registrations: ' + err.message);
    }
  }

  function updateDashboardCards() {
    const total = allRegistrations.length;
    const pending = allRegistrations.filter(r => (r.payment_status || 'pending').toLowerCase() === 'pending').length;
    const verified = allRegistrations.filter(r => (r.payment_status || '').toLowerCase() === 'verified').length;
    const rejected = allRegistrations.filter(r => (r.payment_status || '').toLowerCase() === 'rejected').length;

    // Today's count
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = allRegistrations.filter(r => r.created_at && r.created_at.slice(0, 10) === todayStr).length;

    const revenue = verified * 50;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-verified').textContent = verified;
    document.getElementById('stat-rejected').textContent = rejected;
    document.getElementById('stat-today').textContent = today;
    document.getElementById('stat-revenue').textContent = '₹' + revenue.toLocaleString('en-IN');

    updateSeatAvailabilityCard();
  }

  async function updateSeatAvailabilityCard() {
    const seatVal = document.getElementById('stat-seats-booked');
    const seatSub = document.getElementById('stat-seats-sub');
    if (!seatVal) return;

    try {
      const sb = window.getSupabase();
      if (!sb) return;
      const { data, error } = await sb.rpc('get_seat_availability');
      if (!error && data && data.success) {
        seatVal.textContent = `${data.booked_seats} / ${data.total_seats}`;
        if (seatSub) {
          seatSub.textContent = data.is_full
            ? 'Full Capacity (0 remaining)'
            : `${data.remaining_seats} seats remaining (${data.booking_progress}% filled)`;
        }
      }
    } catch (e) {
      console.warn('Failed to load seat availability card:', e);
    }
  }

  function renderRecentRegistrations() {
    const tbody = document.getElementById('recent-registrations-tbody');
    const recent = allRegistrations.slice(0, 5);

    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--mute);">No registrations yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map(r => {
      const pStatus = (r.payment_status || 'pending').toLowerCase();
      const pMethod = (r.payment_method || 'upi').toLowerCase();
      const dateStr = new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      let proofLabel = '';
      if (pMethod === 'cash') {
        proofLabel = `<span class="badge" style="background: rgba(18,144,122,0.15); color: var(--teal); font-size: 11px;">💵 Cash</span>`;
      } else if (r.payment_screenshot_path) {
        proofLabel = `<span class="badge" style="background: rgba(18,144,122,0.15); color: var(--teal); font-size: 11px;">📸 Proof</span>`;
      } else {
        proofLabel = `<code>${escapeHtml(r.transaction_id || '—')}</code>`;
      }
      return `
        <tr>
          <td><strong>${r.registration_id}</strong></td>
          <td>${escapeHtml(r.full_name)}</td>
          <td>${escapeHtml(r.institution)}</td>
          <td>${proofLabel}</td>
          <td><span class="badge ${pStatus}">${pStatus}</span></td>
          <td>${dateStr}</td>
          <td><button class="btn btn-sm" onclick="openRegistrationDetails('${r.id}')">View</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderRegistrationsTable() {
    const tbody = document.getElementById('registrations-tbody');
    const searchTerm = (document.getElementById('reg-search-input').value || '').toLowerCase().trim();
    const payFilter = document.getElementById('reg-payment-filter').value;
    const methodFilterEl = document.getElementById('reg-method-filter');
    const methodFilter = methodFilterEl ? methodFilterEl.value : 'all';
    const statusFilter = document.getElementById('reg-status-filter').value;
    const dateFilter = document.getElementById('reg-date-filter').value;

    const todayStr = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString();

    const filtered = allRegistrations.filter(r => {
      // Search
      if (searchTerm) {
        const matches = (r.registration_id && r.registration_id.toLowerCase().includes(searchTerm)) ||
          (r.full_name && r.full_name.toLowerCase().includes(searchTerm)) ||
          (r.mobile && r.mobile.includes(searchTerm)) ||
          (r.institution && r.institution.toLowerCase().includes(searchTerm)) ||
          (r.transaction_id && r.transaction_id.toLowerCase().includes(searchTerm)) ||
          (r.payment_method && r.payment_method.toLowerCase().includes(searchTerm)) ||
          (r.cash_received_by && r.cash_received_by.toLowerCase().includes(searchTerm)) ||
          (r.cash_receipt_no && r.cash_receipt_no.toLowerCase().includes(searchTerm)) ||
          (r.payment_screenshot_path && r.payment_screenshot_path.toLowerCase().includes(searchTerm));
        if (!matches) return false;
      }

      // Payment filter
      if (payFilter !== 'all') {
        if ((r.payment_status || 'pending').toLowerCase() !== payFilter) return false;
      }

      // Method filter
      if (methodFilter !== 'all') {
        const rMethod = (r.payment_method || 'upi').toLowerCase();
        if (rMethod !== methodFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if ((r.registration_status || 'submitted').toLowerCase() !== statusFilter) return false;
      }

      // Date filter
      if (dateFilter === 'today') {
        if (!r.created_at || r.created_at.slice(0, 10) !== todayStr) return false;
      } else if (dateFilter === 'week') {
        if (!r.created_at || r.created_at < sevenDaysAgo) return false;
      }

      return true;
    });

    document.getElementById('reg-count-info').textContent = `Showing ${filtered.length} of ${allRegistrations.length} registrations`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--mute); padding: 30px;">No matching registrations found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const pStatus = (r.payment_status || 'pending').toLowerCase();
      const rStatus = (r.registration_status || 'submitted').toLowerCase();
      const pMethod = (r.payment_method || 'upi').toLowerCase();
      const dateStr = new Date(r.created_at).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      let methodProofHtml = '';
      if (pMethod === 'cash') {
        if (pStatus === 'verified') {
          methodProofHtml = `<span class="badge" style="background: rgba(18,144,122,0.15); color: var(--teal); font-size: 11px; font-weight: 600;">💵 Cash (Collected)</span>`;
        } else {
          methodProofHtml = `<span class="badge" style="background: rgba(230,57,70,0.1); color: var(--red); font-size: 11px; font-weight: 600;">💵 Cash (Pending)</span>`;
        }
      } else {
        if (r.payment_screenshot_path) {
          methodProofHtml = `<button type="button" class="btn btn-sm" style="font-size: 11px; padding: 3px 8px; border-color: var(--teal); color: var(--teal);" onclick="openRegistrationDetails('${r.id}')">📸 Proof</button>`;
        } else if (r.transaction_id) {
          methodProofHtml = `<code>${escapeHtml(r.transaction_id)}</code>`;
        } else {
          methodProofHtml = `<span style="font-size: 11px; color: var(--mute);">📱 UPI (Pending)</span>`;
        }
      }

      return `
        <tr>
          <td><strong>${r.registration_id}</strong></td>
          <td>${escapeHtml(r.full_name)}</td>
          <td>${escapeHtml(r.mobile)}</td>
          <td>${escapeHtml(r.institution)}</td>
          <td>${methodProofHtml}</td>
          <td><span class="badge ${pStatus}">${pStatus}</span></td>
          <td><span class="badge ${rStatus}">${rStatus}</span></td>
          <td style="font-size: 11px; color: var(--mute);">${dateStr}</td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button type="button" class="btn btn-sm" title="View Profile" onclick="openRegistrationDetails('${r.id}')">👁️</button>
              ${pMethod === 'cash' && pStatus !== 'verified' ? `
                <button type="button" class="btn btn-sm primary" title="Record Cash Received" style="padding: 3px 8px; font-size: 11px; white-space: nowrap;" onclick="openRecordCashModal('${r.id}')">💵 Record Cash</button>
              ` : ''}
              ${pMethod !== 'cash' && pStatus !== 'verified' ? `
                <button type="button" class="btn btn-sm secondary" title="Verify Payment" onclick="confirmVerifyPayment('${r.id}')">✓</button>
              ` : ''}
              ${pStatus !== 'rejected' ? `
                <button type="button" class="btn btn-sm danger" title="Reject Payment" onclick="confirmRejectPayment('${r.id}')">✕</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Setup Registrations Search and Filter Listeners
  document.getElementById('reg-search-input').oninput = renderRegistrationsTable;
  document.getElementById('reg-payment-filter').onchange = renderRegistrationsTable;
  const regMethodFilter = document.getElementById('reg-method-filter');
  if (regMethodFilter) regMethodFilter.onchange = renderRegistrationsTable;
  document.getElementById('reg-status-filter').onchange = renderRegistrationsTable;
  document.getElementById('reg-date-filter').onchange = renderRegistrationsTable;

  // Export to CSV
  document.getElementById('export-csv-btn').onclick = exportRegistrationsCSV;

  function exportRegistrationsCSV() {
    if (allRegistrations.length === 0) {
      showToast('No registrations to export.');
      return;
    }

    const headers = [
      'Registration ID',
      'Name',
      'Mobile',
      'Email',
      'Institution',
      'Course',
      'Department',
      'District',
      'Payment Method',
      'Payment Screenshot Path',
      'Legacy Transaction ID',
      'Cash Received By',
      'Cash Received At',
      'Cash Amount',
      'Cash Receipt No',
      'Cash Notes',
      'Payment Status',
      'Registration Status',
      'Created At'
    ];

    const rows = allRegistrations.map(r => [
      r.registration_id || '',
      r.full_name || '',
      r.mobile || '',
      r.email || '',
      r.institution || '',
      r.course || '',
      r.department || '',
      r.district || '',
      r.payment_method || 'upi',
      r.payment_screenshot_path || '',
      r.transaction_id || '',
      r.cash_received_by || '',
      r.cash_received_at || '',
      r.cash_amount || '',
      r.cash_receipt_no || '',
      r.cash_notes || '',
      r.payment_status || 'pending',
      r.registration_status || 'submitted',
      r.created_at || ''
    ]);

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hlf_2026_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported registrations to CSV successfully!');
  }

  function escapeCsv(field) {
    if (field === null || field === undefined) return '""';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return `"${stringField}"`;
  }

  // View Details Modal
  async function openRegistrationDetails(regId) {
    const reg = allRegistrations.find(r => r.id === regId);
    if (!reg) return;

    selectedRegistration = reg;
    const modal = document.getElementById('reg-detail-modal');

    document.getElementById('modal-reg-id').textContent = reg.registration_id;
    const pStatus = (reg.payment_status || 'pending').toLowerCase();
    const pMethod = (reg.payment_method || 'upi').toLowerCase();
    const statusBadge = document.getElementById('modal-reg-status-badge');
    statusBadge.className = `badge ${pStatus}`;
    statusBadge.textContent = pStatus;

    const dateStr = new Date(reg.created_at).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Obtain signed screenshot URL if available
    let screenshotUrl = null;
    const sb = window.getSupabase ? window.getSupabase() : null;
    if (sb && reg.payment_screenshot_path) {
      try {
        const { data: signedData, error: signedErr } = await sb.storage
          .from('hlf-payment-proofs')
          .createSignedUrl(reg.payment_screenshot_path, 3600);
        if (!signedErr && signedData?.signedUrl) {
          screenshotUrl = signedData.signedUrl;
        }
      } catch (err) {
        console.warn('Error creating signed URL for screenshot:', err);
      }
    }
    if (!screenshotUrl && reg.payment_screenshot_url) {
      screenshotUrl = reg.payment_screenshot_url;
    }

    document.getElementById('modal-reg-body').innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Participant</span>
          <div style="font-size: 16px; font-weight: bold; margin-top: 2px;">${escapeHtml(reg.full_name)}</div>
        </div>
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Mobile Number</span>
          <div style="font-size: 15px; margin-top: 2px;"><a href="tel:${escapeHtml(reg.mobile)}" style="text-decoration: underline;">${escapeHtml(reg.mobile)}</a></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Email Address</span>
          <div>${escapeHtml(reg.email || 'None provided')}</div>
        </div>
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Institution</span>
          <div style="font-weight: 500;">${escapeHtml(reg.institution)}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Course / Class</span>
          <div>${escapeHtml(reg.course || '—')}</div>
        </div>
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Department</span>
          <div>${escapeHtml(reg.department || '—')}</div>
        </div>
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">District</span>
          <div>${escapeHtml(reg.district || '—')}</div>
        </div>
      </div>

      ${reg.special_requirements ? `
        <div style="margin-bottom: 16px; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 10px;">
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Special Notes</span>
          <div>${escapeHtml(reg.special_requirements)}</div>
        </div>
      ` : ''}

      <div style="border-top: 1px dashed var(--line); padding-top: 14px; margin-top: 14px;">
        <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Payment Details</span>
        <div style="display: flex; justify-content: space-between; margin-top: 6px;">
          <span>Payment Method:</span>
          <strong>${pMethod === 'cash' ? '💵 Cash to Organizer' : '📱 Online via UPI'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px;">
          <span>Registration Fee:</span>
          <strong>₹${reg.registration_fee || 50}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px;">
          <span>Submitted On:</span>
          <span style="color: var(--mute);">${dateStr}</span>
        </div>
        ${reg.transaction_id ? `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
            <span style="color: var(--mute); font-size: 12px;">Legacy UPI Ref:</span>
            <code style="font-size: 12px; background: var(--card); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--line);">${escapeHtml(reg.transaction_id)}</code>
          </div>
        ` : ''}
      </div>

      ${pMethod === 'cash' ? `
        ${reg.cash_received_by ? `
          <div style="margin-top: 14px; background: rgba(18,144,122,0.08); border: 1px solid rgba(18,144,122,0.3); border-radius: 10px; padding: 12px;">
            <div style="font-weight: 700; color: var(--teal); font-size: 12px; margin-bottom: 8px;">💵 Cash Payment Audit Trail</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
              <div><span style="color: var(--mute);">Received By:</span> <strong>${escapeHtml(reg.cash_received_by)}</strong></div>
              <div><span style="color: var(--mute);">Amount:</span> <strong>₹${reg.cash_amount || 50}</strong></div>
              <div><span style="color: var(--mute);">Received At:</span> <span>${reg.cash_received_at ? new Date(reg.cash_received_at).toLocaleString('en-IN') : '—'}</span></div>
              <div><span style="color: var(--mute);">Receipt / Ref:</span> <span>${escapeHtml(reg.cash_receipt_no || '—')}</span></div>
            </div>
            ${reg.cash_notes ? `<div style="margin-top: 8px; font-size: 12px; border-top: 1px dashed rgba(18,144,122,0.2); padding-top: 6px;"><span style="color: var(--mute);">Notes:</span> ${escapeHtml(reg.cash_notes)}</div>` : ''}
          </div>
        ` : `
          <div style="margin-top: 14px; background: rgba(230,57,70,0.06); border: 1px dashed rgba(230,57,70,0.3); border-radius: 10px; padding: 12px;">
            <div style="font-weight: 700; color: var(--red); font-size: 12px; margin-bottom: 4px;">⚠️ Cash Payment Awaiting Collection</div>
            <p style="margin: 0; font-size: 12px; color: var(--ink);">This delegate selected cash payment. Hand over ₹50 directly and click <strong>Record Cash</strong> below to confirm their registration.</p>
          </div>
        `}
      ` : ''}

      ${pMethod !== 'cash' || screenshotUrl ? `
        <div style="margin-top: 16px; border-top: 1px dashed var(--line); padding-top: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: var(--mute); font-size: 11px; text-transform: uppercase; font-weight: 700;">Payment Screenshot Proof</span>
            ${screenshotUrl ? `<a href="${screenshotUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="text-decoration: none; font-size: 11px; padding: 3px 10px;">🔍 Open Full Size ↗</a>` : ''}
          </div>
          ${screenshotUrl ? `
            <div style="text-align: center; background: rgba(0,0,0,0.4); border: 1px solid var(--line); border-radius: 12px; padding: 10px;">
              <a href="${screenshotUrl}" target="_blank" rel="noopener noreferrer" title="Click to view full image in new tab">
                <img src="${screenshotUrl}" alt="Proof for ${reg.registration_id}" style="max-height: 280px; max-width: 100%; border-radius: 8px; object-fit: contain; cursor: zoom-in; display: block; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.3);" />
              </a>
              <div style="font-size: 11px; color: var(--mute); margin-top: 8px;">
                Path: <code>${escapeHtml(reg.payment_screenshot_path || 'uploaded')}</code> · Click image to expand
              </div>
            </div>
          ` : `
            <div style="padding: 18px; text-align: center; background: rgba(0,0,0,0.03); border: 1px dashed var(--line); border-radius: 10px; color: var(--mute); font-size: 13px;">
              📷 No payment screenshot available.
            </div>
          `}
        </div>
      ` : ''}
    `;

    // Configure action buttons in details modal
    const recordCashBtn = document.getElementById('modal-btn-record-cash');
    const verifyBtn = document.getElementById('modal-btn-verify');
    const rejectBtn = document.getElementById('modal-btn-reject');
    const deleteBtn = document.getElementById('modal-btn-delete');
    const whatsappBtn = document.getElementById('modal-btn-whatsapp');

    if (recordCashBtn) {
      if (pStatus !== 'verified') {
        recordCashBtn.style.display = 'inline-block';
        recordCashBtn.onclick = () => {
          modal.close();
          openRecordCashModal(reg.id);
        };
      } else {
        recordCashBtn.style.display = 'none';
      }
    }

    if (verifyBtn) {
      if (pStatus !== 'verified') {
        verifyBtn.style.display = 'inline-block';
        if (pMethod === 'cash') {
          verifyBtn.textContent = '💵 Record Cash';
          verifyBtn.className = 'btn primary';
          verifyBtn.onclick = () => {
            modal.close();
            openRecordCashModal(reg.id);
          };
        } else {
          verifyBtn.textContent = '✓ Verify Payment';
          verifyBtn.className = 'btn secondary';
          verifyBtn.onclick = () => confirmVerifyPayment(reg.id);
        }
      } else {
        verifyBtn.style.display = 'none';
      }
    }

    if (rejectBtn) {
      rejectBtn.style.display = pStatus !== 'rejected' ? 'inline-block' : 'none';
      rejectBtn.onclick = () => confirmRejectPayment(reg.id);
    }

    if (deleteBtn) {
      deleteBtn.onclick = () => confirmDeleteRegistration(reg.id);
    }

    if (whatsappBtn) {
      whatsappBtn.onclick = () => openWhatsAppForRegistration(reg);
    }

    modal.showModal();
  }
  window.openRegistrationDetails = openRegistrationDetails;

  async function confirmVerifyPayment(id) {
    const reg = allRegistrations.find(r => r.id === id);
    if (!reg) return;

    if (!confirm(`Verify ₹50 UPI payment for ${reg.full_name} (${reg.registration_id})?`)) {
      return;
    }

    const sb = window.getSupabase();
    try {
      const { error } = await sb.from('registrations').update({
        payment_status: 'verified',
        registration_status: 'confirmed',
        updated_at: new Date().toISOString()
      }).eq('id', id);

      if (error) throw error;
      showToast(`Payment verified for ${reg.registration_id}`);
      document.getElementById('reg-detail-modal').close();
      await loadRegistrations();
    } catch (err) {
      alert('Verification error: ' + err.message);
    }
  }
  window.confirmVerifyPayment = confirmVerifyPayment;

  async function confirmRejectPayment(id) {
    const reg = allRegistrations.find(r => r.id === id);
    if (!reg) return;

    if (!confirm(`Mark payment as REJECTED for ${reg.full_name} (${reg.registration_id})?`)) {
      return;
    }

    const sb = window.getSupabase();
    try {
      const { error } = await sb.from('registrations').update({
        payment_status: 'rejected',
        registration_status: 'cancelled',
        updated_at: new Date().toISOString()
      }).eq('id', id);

      if (error) throw error;
      showToast(`Payment rejected for ${reg.registration_id}`);
      document.getElementById('reg-detail-modal').close();
      await loadRegistrations();
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  }
  window.confirmRejectPayment = confirmRejectPayment;

  async function confirmDeleteRegistration(id) {
    const reg = allRegistrations.find(r => r.id === id);
    if (!reg) return;

    if (!confirm(`WARNING: Are you sure you want to permanently delete registration ${reg.registration_id} (${reg.full_name})?\n\nThis cannot be undone.`)) {
      return;
    }

    const sb = window.getSupabase();
    try {
      const { error } = await sb.from('registrations').delete().eq('id', id);
      if (error) throw error;
      showToast(`Registration ${reg.registration_id} deleted.`);
      document.getElementById('reg-detail-modal').close();
      await loadRegistrations();
    } catch (err) {
      alert('Deletion error: ' + err.message);
    }
  }
  window.confirmDeleteRegistration = confirmDeleteRegistration;

  // -------------------------------------------------------------
  // RECORD CASH PAYMENT MODAL & WORKFLOW
  // -------------------------------------------------------------
  function openRecordCashModal(id) {
    const reg = allRegistrations.find(r => r.id === id);
    if (!reg) return;

    const modal = document.getElementById('record-cash-modal');
    if (!modal) return;

    document.getElementById('rc-reg-id').textContent = reg.registration_id;
    document.getElementById('rc-delegate-name').textContent = reg.full_name || '—';
    document.getElementById('rc-delegate-mobile').textContent = reg.mobile || '—';
    document.getElementById('rc-amount').value = reg.registration_fee || 50;

    // Default datetime-local to current local time formatted as YYYY-MM-DDTHH:mm
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const localDatetime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    document.getElementById('rc-datetime').value = localDatetime;

    const adminEmail = (currentUser && currentUser.email) ? currentUser.email : 'Authorized Admin';
    document.getElementById('rc-admin-display').value = adminEmail;
    document.getElementById('rc-receipt-ref').value = '';
    document.getElementById('rc-notes').value = '';

    const errBanner = document.getElementById('rc-error-banner');
    if (errBanner) {
      errBanner.style.display = 'none';
      errBanner.textContent = '';
    }

    const form = document.getElementById('record-cash-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleRecordCashSubmit(reg);
    };

    modal.showModal();
  }
  window.openRecordCashModal = openRecordCashModal;

  async function handleRecordCashSubmit(reg) {
    const submitBtn = document.getElementById('rc-submit-btn');
    const errBanner = document.getElementById('rc-error-banner');
    if (errBanner) {
      errBanner.style.display = 'none';
      errBanner.textContent = '';
    }

    const amount = Number(document.getElementById('rc-amount').value) || 50;
    const datetimeVal = document.getElementById('rc-datetime').value;
    const receiptNo = document.getElementById('rc-receipt-ref').value.trim();
    const notes = document.getElementById('rc-notes').value.trim();

    if (amount <= 0) {
      if (errBanner) {
        errBanner.textContent = 'Please enter a valid amount (₹50).';
        errBanner.style.display = 'block';
      }
      return;
    }

    const receivedAtISO = datetimeVal ? new Date(datetimeVal).toISOString() : new Date().toISOString();

    if (!confirm(`Confirm receiving ₹${amount} cash from ${reg.full_name} (${reg.registration_id})?\n\nThis will confirm the registration and write to the audit trail.`)) {
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording cash...';

    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) {
      if (errBanner) {
        errBanner.textContent = 'Supabase client is not available.';
        errBanner.style.display = 'block';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = '💵 Confirm & Save Cash Received';
      return;
    }

    try {
      const { data, error } = await sb.rpc('record_cash_payment', {
        p_registration_id: reg.registration_id,
        p_amount: amount,
        p_receipt_no: receiptNo || null,
        p_notes: notes || null,
        p_received_at: receivedAtISO
      });

      if (error) throw error;

      showToast(`✓ Cash payment of ₹${amount} recorded for ${reg.registration_id}!`);
      document.getElementById('record-cash-modal').close();
      const detailModal = document.getElementById('reg-detail-modal');
      if (detailModal && detailModal.open) {
        detailModal.close();
      }
      await loadRegistrations();
    } catch (err) {
      console.error('Failed to record cash payment:', err);
      if (errBanner) {
        errBanner.textContent = err.message || 'Error recording cash payment. Please check your admin privileges.';
        errBanner.style.display = 'block';
      } else {
        alert('Error recording cash payment: ' + err.message);
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '💵 Confirm & Save Cash Received';
    }
  }

  // -------------------------------------------------------------
  // PAYMENT-METHOD-AWARE WHATSAPP NOTIFICATIONS
  // -------------------------------------------------------------
  function openWhatsAppForRegistration(reg) {
    if (!reg || !reg.mobile) {
      showToast('No mobile number available for this delegate.');
      return;
    }

    let cleanMobile = reg.mobile.replace(/\D/g, '');
    if (cleanMobile.length === 10) {
      cleanMobile = '91' + cleanMobile;
    }

    const pStatus = (reg.payment_status || 'pending').toLowerCase();
    const pMethod = (reg.payment_method || 'upi').toLowerCase();
    const fee = reg.registration_fee || 50;

    let msg = '';
    if (pMethod === 'cash') {
      if (pStatus === 'verified') {
        msg = `Assalamu Alaikum ${reg.full_name},\n\nYour registration for Hadith Literature Festival (HLF 2026) has been CONFIRMED!\n\n📋 Registration ID: ${reg.registration_id}\n💵 Payment: ₹${reg.cash_amount || fee} Cash Received\n📅 Dates: 30, 31 January & 1 February 2026\n📍 Venue: DHIU, Chemmad, Kerala\n\nWe look forward to welcoming you!\n\n— Hadith Literature Festival 2026 Team`;
      } else {
        msg = `Assalamu Alaikum ${reg.full_name},\n\nRegarding your HLF 2026 Delegate Registration (${reg.registration_id}):\n\nYour registration has been submitted. Please pay the ₹${fee} registration fee directly in cash to an authorized HLF organizer to confirm your registration.\n\nThank you!\n— Hadith Literature Festival 2026 Team`;
      }
    } else {
      if (pStatus === 'verified') {
        msg = `Assalamu Alaikum ${reg.full_name},\n\nYour registration for Hadith Literature Festival (HLF 2026) has been CONFIRMED!\n\n📋 Registration ID: ${reg.registration_id}\n📱 Payment: ₹${fee} (UPI Verified)\n📅 Dates: 30, 31 January & 1 February 2026\n📍 Venue: DHIU, Chemmad, Kerala\n\nWe look forward to welcoming you!\n\n— Hadith Literature Festival 2026 Team`;
      } else {
        msg = `Assalamu Alaikum ${reg.full_name},\n\nRegarding your HLF 2026 Delegate Registration (${reg.registration_id}):\n\nPlease complete your ₹${fee} registration fee via UPI and upload the screenshot proof to confirm your registration.\n\nUPI ID: festivalhadith@okaxis\n\nThank you!\n— Hadith Literature Festival 2026 Team`;
      }
    }

    const url = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  window.openWhatsAppForRegistration = openWhatsAppForRegistration;

  // -------------------------------------------------------------
  // QUIZ COMPETITION MANAGEMENT
  // -------------------------------------------------------------
  function setupQuizListeners() {
    const searchInput = document.getElementById('quiz-search-input');
    if (searchInput) searchInput.oninput = renderQuizTable;

    const statusFilter = document.getElementById('quiz-status-filter');
    if (statusFilter) statusFilter.onchange = renderQuizTable;

    const dateFilter = document.getElementById('quiz-date-filter');
    if (dateFilter) dateFilter.onchange = renderQuizTable;

    const exportBtn = document.getElementById('export-quiz-csv-btn');
    if (exportBtn) exportBtn.onclick = exportQuizCSV;

    const saveStatusBtn = document.getElementById('modal-quiz-save-status-btn');
    if (saveStatusBtn) saveStatusBtn.onclick = saveQuizStatus;

    const deleteBtn = document.getElementById('modal-quiz-btn-delete');
    if (deleteBtn) deleteBtn.onclick = confirmDeleteQuizRegistration;
  }

  async function loadQuizRegistrations() {
    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) return;

    try {
      const { data, error } = await sb
        .from('quiz_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allQuizRegistrations = data || [];

      const statQuiz = document.getElementById('stat-quiz-total');
      if (statQuiz) statQuiz.textContent = allQuizRegistrations.length;

      renderQuizTable();
    } catch (err) {
      console.error('Failed to load quiz registrations:', err);
    }
  }

  function renderQuizTable() {
    const tbody = document.getElementById('quiz-tbody');
    if (!tbody) return;

    const searchInput = document.getElementById('quiz-search-input');
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const statusFilter = document.getElementById('quiz-status-filter') ? document.getElementById('quiz-status-filter').value : 'all';
    const dateFilter = document.getElementById('quiz-date-filter') ? document.getElementById('quiz-date-filter').value : 'all';

    const todayStr = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString();

    const filtered = allQuizRegistrations.filter(q => {
      if (searchTerm) {
        const matches = (q.quiz_ref && q.quiz_ref.toLowerCase().includes(searchTerm)) ||
          (q.full_name && q.full_name.toLowerCase().includes(searchTerm)) ||
          (q.mobile && q.mobile.includes(searchTerm)) ||
          (q.email && q.email.toLowerCase().includes(searchTerm)) ||
          (q.institution && q.institution.toLowerCase().includes(searchTerm)) ||
          (q.district && q.district.toLowerCase().includes(searchTerm)) ||
          (q.course && q.course.toLowerCase().includes(searchTerm)) ||
          (q.department && q.department.toLowerCase().includes(searchTerm)) ||
          (q.team_name && q.team_name.toLowerCase().includes(searchTerm));
        if (!matches) return false;
      }

      if (statusFilter !== 'all') {
        if ((q.status || 'registered').toLowerCase() !== statusFilter) return false;
      }

      if (dateFilter === 'today') {
        if (!q.created_at || q.created_at.slice(0, 10) !== todayStr) return false;
      } else if (dateFilter === 'week') {
        if (!q.created_at || q.created_at < sevenDaysAgo) return false;
      }

      return true;
    });

    const countInfo = document.getElementById('quiz-count-info');
    if (countInfo) {
      countInfo.textContent = `Showing ${filtered.length} of ${allQuizRegistrations.length} registrations`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--mute); padding: 30px;">No matching quiz registrations found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(q => {
      const status = (q.status || 'registered').toLowerCase();
      const dateStr = new Date(q.created_at).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      let statusBadgeClass = 'pending';
      if (status === 'shortlisted') statusBadgeClass = 'amber';
      else if (status === 'attended') statusBadgeClass = 'verified';
      else if (status === 'cancelled') statusBadgeClass = 'rejected';
      else if (status === 'registered') statusBadgeClass = 'confirmed';

      return `
        <tr>
          <td><strong style="color: var(--teal); font-family: 'Fira Code', monospace;">${escapeHtml(q.quiz_ref || '—')}</strong></td>
          <td><strong>${escapeHtml(q.full_name || '—')}</strong></td>
          <td><a href="tel:${escapeHtml(q.mobile || '')}" style="text-decoration: underline;">${escapeHtml(q.mobile || '—')}</a></td>
          <td>${escapeHtml(q.institution || '—')}${q.course ? ` <span style="font-size: 11px; color: var(--mute);">(${escapeHtml(q.course)})</span>` : ''}</td>
          <td>${escapeHtml(q.district || '—')}</td>
          <td><span class="badge ${statusBadgeClass}">${status}</span></td>
          <td style="font-size: 11px; color: var(--mute);">${dateStr}</td>
          <td>
            <button type="button" class="btn btn-sm" onclick="openQuizDetails('${q.id}')">View</button>
          </td>
        </tr>
      `;
    }).join('');
  }
  window.renderQuizTable = renderQuizTable;

  function openQuizDetails(id) {
    const q = allQuizRegistrations.find(item => item.id === id);
    if (!q) return;

    selectedQuizRegistration = q;
    const modal = document.getElementById('quiz-detail-modal');
    if (!modal) return;

    document.getElementById('modal-quiz-id').textContent = q.quiz_ref || 'HLF26-QUIZ';
    const statusBadge = document.getElementById('modal-quiz-status-badge');
    const status = (q.status || 'registered').toLowerCase();
    statusBadge.textContent = status;
    statusBadge.className = `badge ${status === 'attended' ? 'verified' : (status === 'cancelled' ? 'rejected' : 'pending')}`;

    const dateStr = new Date(q.created_at).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const statusSelect = document.getElementById('modal-quiz-status-select');
    if (statusSelect) statusSelect.value = status;

    const body = document.getElementById('modal-quiz-body');
    body.innerHTML = `
      <div style="background: rgba(18,144,122,0.08); border: 1px solid rgba(18,144,122,0.2); border-radius: 12px; padding: 12px; margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 700; color: var(--teal);">🏆 HADITH LIVE QUIZ PROGRAMME</div>
        <div style="font-size: 11px; color: var(--mute); margin-top: 2px;">Day 3 — 20 October 2026, 2:00 PM – 5:00 PM · Darul Hikma, Chemmad</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Participant Name</span>
          <div style="font-size: 16px; font-weight: bold; margin-top: 2px;">${escapeHtml(q.full_name || '—')}</div>
        </div>
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Mobile Number</span>
          <div style="font-size: 15px; margin-top: 2px;"><a href="tel:${escapeHtml(q.mobile || '')}" style="text-decoration: underline;">${escapeHtml(q.mobile || '—')}</a></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Email Address</span>
          <div>${escapeHtml(q.email || 'None provided')}</div>
        </div>
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">District</span>
          <div>${escapeHtml(q.district || '—')}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">College / Institution</span>
          <div style="font-weight: 600;">${escapeHtml(q.institution || '—')}</div>
        </div>
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Course / Department</span>
          <div>${escapeHtml([q.course, q.department].filter(Boolean).join(' · ') || '—')}</div>
        </div>
      </div>

      ${(q.team_name || q.partner_name || q.partner_mobile) ? `
        <div style="border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin-bottom: 16px; background: rgba(0,0,0,0.02);">
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase; font-weight: 700;">Team Details</span>
          <div style="font-size: 13px; margin-top: 4px;">
            ${q.team_name ? `<div>Team: <strong>${escapeHtml(q.team_name)}</strong></div>` : ''}
            ${q.partner_name ? `<div>Partner: ${escapeHtml(q.partner_name)} ${q.partner_mobile ? `(${escapeHtml(q.partner_mobile)})` : ''}</div>` : ''}
          </div>
        </div>
      ` : ''}

      ${q.notes ? `
        <div style="margin-bottom: 16px;">
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Participant Notes</span>
          <div style="background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 10px; font-size: 12px; margin-top: 4px;">${escapeHtml(q.notes)}</div>
        </div>
      ` : ''}

      <div style="font-size: 11px; color: var(--mute); margin-top: 10px;">
        Registered on: ${dateStr}
      </div>
    `;

    const whatsappBtn = document.getElementById('modal-quiz-btn-whatsapp');
    if (whatsappBtn) {
      whatsappBtn.onclick = () => openWhatsAppForQuiz(q);
    }

    modal.showModal();
  }
  window.openQuizDetails = openQuizDetails;

  async function saveQuizStatus() {
    if (!selectedQuizRegistration) return;
    const select = document.getElementById('modal-quiz-status-select');
    if (!select) return;

    const newStatus = select.value;
    const saveBtn = document.getElementById('modal-quiz-save-status-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) return;

    try {
      const { error: rpcErr } = await sb.rpc('update_quiz_registration_status', {
        p_reg_id: selectedQuizRegistration.id,
        p_new_status: newStatus
      });

      if (rpcErr) {
        const { error: directErr } = await sb
          .from('quiz_registrations')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', selectedQuizRegistration.id);
        if (directErr) throw directErr;
      }

      selectedQuizRegistration.status = newStatus;
      const badge = document.getElementById('modal-quiz-status-badge');
      if (badge) {
        badge.textContent = newStatus;
        badge.className = `badge ${newStatus === 'attended' ? 'verified' : (newStatus === 'cancelled' ? 'rejected' : 'pending')}`;
      }

      showToast(`Status updated to "${newStatus}" for ${selectedQuizRegistration.quiz_ref}`);
      await loadQuizRegistrations();
    } catch (err) {
      console.error('Failed to update quiz status:', err);
      alert('Error updating status: ' + err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    }
  }

  async function confirmDeleteQuizRegistration() {
    if (!selectedQuizRegistration) return;
    const q = selectedQuizRegistration;

    if (!confirm(`WARNING: Are you sure you want to permanently delete quiz registration ${q.quiz_ref} (${q.full_name})?\n\nThis cannot be undone.`)) {
      return;
    }

    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) return;

    try {
      const { error } = await sb.from('quiz_registrations').delete().eq('id', q.id);
      if (error) throw error;

      showToast(`Quiz registration ${q.quiz_ref} deleted.`);
      const modal = document.getElementById('quiz-detail-modal');
      if (modal && modal.open) modal.close();
      await loadQuizRegistrations();
    } catch (err) {
      console.error('Failed to delete quiz registration:', err);
      alert('Deletion error: ' + err.message);
    }
  }

  function openWhatsAppForQuiz(q) {
    if (!q || !q.mobile) {
      showToast('No mobile number available for this participant.');
      return;
    }

    let cleanMobile = q.mobile.replace(/\D/g, '');
    if (cleanMobile.length === 10) {
      cleanMobile = '91' + cleanMobile;
    }

    const msg = `Assalamu Alaikum ${q.full_name || 'Participant'},\n\nYour registration for the Hadith Live Quiz Programme (HLF 2026) has been confirmed!\n\n🏆 Quiz Reference: ${q.quiz_ref || 'HLF26-QUIZ'}\n📅 Date: Day 3 — 20 October 2026, 2:00 PM – 5:00 PM\n📍 Venue: Darul Hikma, DHIU, Chemmad, Kerala\n\nPlease arrive 15 minutes before the scheduled time.\n\n— Hadith Literature Festival 2026 Team`;

    const url = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  window.openWhatsAppForQuiz = openWhatsAppForQuiz;

  function exportQuizCSV() {
    if (allQuizRegistrations.length === 0) {
      showToast('No quiz registrations to export.');
      return;
    }

    const headers = [
      'Quiz Ref',
      'Full Name',
      'Mobile',
      'Email',
      'Institution',
      'Course',
      'Department',
      'District',
      'Status',
      'Team Name',
      'Partner Name',
      'Partner Mobile',
      'Notes',
      'Created At'
    ];

    const rows = allQuizRegistrations.map(q => [
      q.quiz_ref || '',
      q.full_name || '',
      q.mobile || '',
      q.email || '',
      q.institution || '',
      q.course || '',
      q.department || '',
      q.district || '',
      q.status || 'registered',
      q.team_name || '',
      q.partner_name || '',
      q.partner_mobile || '',
      q.notes || '',
      q.created_at || ''
    ]);

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hlf_2026_quiz_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported quiz registrations to CSV successfully!');
  }

  // -------------------------------------------------------------
  // CONTRIBUTIONS MANAGEMENT
  // -------------------------------------------------------------
  async function loadContributions() {
    const sb = window.getSupabase();
    if (!sb) return;
    try {
      const { data, error } = await sb
        .from('contributions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allContributions = data || [];

      await loadContributionSettings();
      updateContributionStats();
      renderContributionsTable();
      renderRecentContributions();
    } catch (err) {
      console.error('Failed to load contributions:', err);
      if (currentUser) {
        showToast('Error loading contributions: ' + err.message);
      }
    }
  }

  async function loadContributionSettings() {
    const sb = window.getSupabase();
    if (!sb) return;
    try {
      const { data } = await sb.from('festival_settings').select('donation_goal').eq('id', 'general').maybeSingle();
      if (data && data.donation_goal && Number(data.donation_goal) > 0) {
        currentContributionTarget = Number(data.donation_goal);
      }
    } catch (e) {
      console.warn('Error loading contribution target setting:', e);
    }
    const targetInput = document.getElementById('admin-target-amount');
    if (targetInput) {
      targetInput.value = currentContributionTarget;
    }
    const previewEl = document.getElementById('target-formatted-preview');
    if (previewEl) {
      previewEl.textContent = 'Formatted: ₹' + currentContributionTarget.toLocaleString('en-IN');
    }
  }

  function updateAdminTargetProgress() {
    const verifiedRaised = allContributions
      .filter(c => (c.payment_status || '').toUpperCase() === 'VERIFIED')
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const target = currentContributionTarget > 0 ? currentContributionTarget : 50000;
    const rawPct = target > 0 ? (verifiedRaised / target) * 100 : 0;
    const displayPct = rawPct > 0 ? (rawPct >= 100 ? 100 : Math.round(rawPct * 10) / 10) : 0;
    const barPct = Math.min(100, Math.max(0, rawPct));

    const raisedEl = document.getElementById('admin-target-raised');
    if (raisedEl) raisedEl.textContent = '₹' + verifiedRaised.toLocaleString('en-IN');

    const pctEl = document.getElementById('admin-target-pct');
    if (pctEl) pctEl.textContent = displayPct + '%';

    const barEl = document.getElementById('admin-target-bar');
    if (barEl) barEl.style.width = barPct + '%';
  }

  function setupContributionTargetForm() {
    const targetInput = document.getElementById('admin-target-amount');
    const previewEl = document.getElementById('target-formatted-preview');
    const valMsg = document.getElementById('target-validation-msg');
    const form = document.getElementById('contrib-target-form');

    if (targetInput) {
      targetInput.addEventListener('input', () => {
        const valStr = targetInput.value.trim();
        const num = Number(valStr);
        if (valStr !== '' && !isNaN(num) && num > 0 && Number.isInteger(num)) {
          if (previewEl) previewEl.textContent = 'Formatted: ₹' + num.toLocaleString('en-IN');
          if (valMsg) valMsg.style.display = 'none';
        } else if (valStr === '') {
          if (previewEl) previewEl.textContent = '';
        } else {
          if (previewEl) previewEl.textContent = 'Invalid amount';
        }
      });
    }

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const valStr = targetInput ? targetInput.value.trim() : '';
        const num = Number(valStr);

        // PART 13 Validation Rules:
        // - Required
        // - Positive number
        // - Whole rupee amounts
        // - Reject 0
        // - Reject negative numbers
        // - Reject invalid text
        // - Reject empty values
        if (!valStr || isNaN(num) || num <= 0 || !Number.isInteger(num)) {
          if (valMsg) {
            valMsg.textContent = 'Target Amount must be a positive whole rupee amount greater than 0.';
            valMsg.style.display = 'block';
          }
          return;
        }

        if (valMsg) valMsg.style.display = 'none';

        const sb = window.getSupabase();
        if (!sb) {
          alert('Supabase client unavailable.');
          return;
        }

        const saveBtn = document.getElementById('save-target-btn');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';
        }

        try {
          const { error } = await sb.from('festival_settings').upsert({
            id: 'general',
            donation_goal: num,
            updated_at: new Date().toISOString()
          });

          if (error) throw error;

          currentContributionTarget = num;
          if (previewEl) previewEl.textContent = 'Formatted: ₹' + num.toLocaleString('en-IN');
          updateAdminTargetProgress();
          showToast('Contribution target updated successfully.');
        } catch (err) {
          console.error('Failed to save contribution target:', err);
          alert('Error saving target: ' + err.message);
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save Target';
          }
        }
      };
    }
  }

  function updateContributionStats() {
    const total = allContributions.length;
    const pending = allContributions.filter(c => (c.payment_status || 'PENDING').toUpperCase() === 'PENDING').length;
    const verified = allContributions.filter(c => (c.payment_status || '').toUpperCase() === 'VERIFIED').length;
    const rejected = allContributions.filter(c => (c.payment_status || '').toUpperCase() === 'REJECTED').length;

    // Total Amount Received (sum of verified contributions)
    const totalAmount = allContributions
      .filter(c => (c.payment_status || '').toUpperCase() === 'VERIFIED')
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    // Today's contributions
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = allContributions.filter(c => c.created_at && c.created_at.slice(0, 10) === todayStr).length;

    // Unique contributors count (by mobile or name)
    const uniqueDonors = new Set(allContributions.map(c => (c.mobile || c.full_name || '').toLowerCase().trim())).size;

    // Update stat cards in #pane-contributions
    const elTotal = document.getElementById('stat-contrib-total');
    if (elTotal) elTotal.textContent = total;

    const elPending = document.getElementById('stat-contrib-pending');
    if (elPending) elPending.textContent = pending;

    const elVerified = document.getElementById('stat-contrib-verified');
    if (elVerified) elVerified.textContent = verified;

    const elRejected = document.getElementById('stat-contrib-rejected');
    if (elRejected) elRejected.textContent = rejected;

    const elAmount = document.getElementById('stat-contrib-amount');
    if (elAmount) elAmount.textContent = '₹' + totalAmount.toLocaleString('en-IN');

    const elToday = document.getElementById('stat-contrib-today');
    if (elToday) elToday.textContent = todayCount;

    const elDonors = document.getElementById('stat-contrib-donors');
    if (elDonors) elDonors.textContent = uniqueDonors;

    // Also update Admin Support Target & Progress
    updateAdminTargetProgress();
  }

  function renderRecentContributions() {
    const tbody = document.getElementById('recent-contributions-tbody');
    if (!tbody) return;

    const recent = allContributions.slice(0, 5);
    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--mute);">No contributions recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map(c => {
      const pStatus = (c.payment_status || 'PENDING').toUpperCase();
      const badgeClass = pStatus === 'VERIFIED' ? 'verified' : (pStatus === 'REJECTED' ? 'rejected' : 'pending');
      const dateStr = new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      return `
        <tr>
          <td><strong>${c.contribution_id}</strong></td>
          <td>${escapeHtml(c.full_name)}</td>
          <td><span class="badge" style="background: rgba(255,255,255,0.08);">${escapeHtml(c.contribution_type || 'Contribution')}</span></td>
          <td><strong>₹${Number(c.amount).toLocaleString('en-IN')}</strong></td>
          <td><code>${escapeHtml(c.transaction_id || '—')}</code></td>
          <td><span class="badge ${badgeClass}">${pStatus}</span></td>
          <td style="font-size: 11px; color: var(--mute);">${dateStr}</td>
          <td><button type="button" class="btn btn-sm" onclick="openContributionDetails('${c.id}')">View</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderContributionsTable() {
    const tbody = document.getElementById('contributions-tbody');
    if (!tbody) return;

    const searchInput = document.getElementById('contrib-search-input');
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const payFilter = (document.getElementById('contrib-payment-filter')?.value || 'all').toUpperCase();
    const typeFilter = (document.getElementById('contrib-type-filter')?.value || 'all').toLowerCase();
    const dateFilter = document.getElementById('contrib-date-filter')?.value || 'all';

    const todayStr = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString();

    const filtered = allContributions.filter(c => {
      // Search by: Contribution ID, Name, Mobile, Transaction ID
      if (searchTerm) {
        const matches = (c.contribution_id && c.contribution_id.toLowerCase().includes(searchTerm)) ||
          (c.full_name && c.full_name.toLowerCase().includes(searchTerm)) ||
          (c.mobile && c.mobile.includes(searchTerm)) ||
          (c.transaction_id && c.transaction_id.toLowerCase().includes(searchTerm));
        if (!matches) return false;
      }

      // Payment Status Filter
      if (payFilter !== 'ALL') {
        const status = (c.payment_status || 'PENDING').toUpperCase();
        if (status !== payFilter) return false;
      }

      // Type Filter
      if (typeFilter !== 'all') {
        const type = (c.contribution_type || '').toLowerCase();
        if (!type.includes(typeFilter)) return false;
      }

      // Date Filter
      if (dateFilter === 'today') {
        if (!c.created_at || c.created_at.slice(0, 10) !== todayStr) return false;
      } else if (dateFilter === 'week') {
        if (!c.created_at || c.created_at < sevenDaysAgo) return false;
      }

      return true;
    });

    const infoEl = document.getElementById('contrib-count-info');
    if (infoEl) {
      infoEl.textContent = `Showing ${filtered.length} of ${allContributions.length} contributions`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--mute); padding: 30px;">No matching contributions found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const pStatus = (c.payment_status || 'PENDING').toUpperCase();
      const badgeClass = pStatus === 'VERIFIED' ? 'verified' : (pStatus === 'REJECTED' ? 'rejected' : 'pending');
      const dateStr = new Date(c.created_at).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const proofDisplay = (c.payment_screenshot_path || c.payment_screenshot_url)
        ? '<span style="color: var(--teal); font-weight: 600; font-size: 12px;">📷 Screenshot ✓</span>'
        : `<code>${escapeHtml(c.transaction_id || '—')}</code>`;

      return `
        <tr>
          <td><strong>${c.contribution_id}</strong></td>
          <td>${escapeHtml(c.full_name)}</td>
          <td><a href="tel:${escapeHtml(c.mobile)}" style="text-decoration: underline;">${escapeHtml(c.mobile)}</a></td>
          <td style="color: var(--mute);">${escapeHtml(c.email || '—')}</td>
          <td><span class="badge" style="background: rgba(255,255,255,0.08);">${escapeHtml(c.contribution_type || 'Contribution')}${c.is_custom ? ' (Custom)' : ''}</span></td>
          <td><strong style="color: var(--teal);">₹${Number(c.amount).toLocaleString('en-IN')}</strong></td>
          <td>${proofDisplay}</td>
          <td><span class="badge ${badgeClass}">${pStatus}</span></td>
          <td style="font-size: 11px; color: var(--mute);">${dateStr}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn btn-sm" title="View Details" onclick="openContributionDetails('${c.id}')">👁️</button>
              ${pStatus !== 'VERIFIED' ? `<button type="button" class="btn btn-sm secondary" title="Verify Payment" onclick="confirmVerifyContribution('${c.id}')">✓</button>` : ''}
              ${pStatus !== 'REJECTED' ? `<button type="button" class="btn btn-sm danger" title="Reject Payment" onclick="confirmRejectContribution('${c.id}')">✕</button>` : ''}
              <button type="button" class="btn btn-sm danger" title="Delete Contribution" onclick="confirmDeleteContribution('${c.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Setup Contributions Search & Filter event listeners
  const contribSearch = document.getElementById('contrib-search-input');
  if (contribSearch) contribSearch.oninput = renderContributionsTable;
  const contribPayFilter = document.getElementById('contrib-payment-filter');
  if (contribPayFilter) contribPayFilter.onchange = renderContributionsTable;
  const contribTypeFilter = document.getElementById('contrib-type-filter');
  if (contribTypeFilter) contribTypeFilter.onchange = renderContributionsTable;
  const contribDateFilter = document.getElementById('contrib-date-filter');
  if (contribDateFilter) contribDateFilter.onchange = renderContributionsTable;

  // Export Contributions to CSV
  const exportContribBtn = document.getElementById('export-contrib-csv-btn');
  if (exportContribBtn) exportContribBtn.onclick = exportContributionsCSV;

  function exportContributionsCSV() {
    if (allContributions.length === 0) {
      showToast('No contributions to export.');
      return;
    }

    const headers = [
      'Contribution ID',
      'Name',
      'Mobile',
      'Email',
      'Contribution Type',
      'Amount',
      'Transaction ID / Screenshot',
      'Payment Status',
      'Created Date'
    ];

    const rows = allContributions.map(c => [
      c.contribution_id || '',
      c.full_name || '',
      c.mobile || '',
      c.email || '',
      c.contribution_type || '',
      c.amount || '',
      c.payment_screenshot_path ? 'Screenshot Proof' : (c.transaction_id || ''),
      (c.payment_status || 'PENDING').toUpperCase(),
      c.created_at || ''
    ]);

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hlf_2026_contributions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Exported contributions to CSV successfully!');
  }

  // View Contribution Details Modal
  async function openContributionDetails(contribId) {
    const contrib = allContributions.find(c => c.id === contribId);
    if (!contrib) return;

    selectedContribution = contrib;
    const modal = document.getElementById('contrib-detail-modal');

    document.getElementById('modal-contrib-id').textContent = contrib.contribution_id;
    const pStatus = (contrib.payment_status || 'PENDING').toUpperCase();
    const statusBadge = document.getElementById('modal-contrib-status-badge');
    const badgeClass = pStatus === 'VERIFIED' ? 'verified' : (pStatus === 'REJECTED' ? 'rejected' : 'pending');
    statusBadge.className = `badge ${badgeClass}`;
    statusBadge.textContent = pStatus;

    const dateStr = new Date(contrib.created_at).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const sb = window.getSupabase();
    let screenshotUrl = null;
    if (sb && contrib.payment_screenshot_path) {
      try {
        const { data: signData, error: signErr } = await sb.storage
          .from('hlf-contribution-payment-proofs')
          .createSignedUrl(contrib.payment_screenshot_path, 3600);
        if (!signErr && signData && signData.signedUrl) {
          screenshotUrl = signData.signedUrl;
        }
      } catch (e) {
        console.warn('Signed URL generation failed:', e);
      }
    }
    if (!screenshotUrl && contrib.payment_screenshot_url) {
      screenshotUrl = contrib.payment_screenshot_url;
    }

    document.getElementById('modal-contrib-body').innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Contributor</span>
          <div style="font-size: 16px; font-weight: bold; margin-top: 2px;">${escapeHtml(contrib.full_name)}</div>
        </div>
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Mobile Number</span>
          <div style="font-size: 15px; margin-top: 2px;"><a href="tel:${escapeHtml(contrib.mobile)}" style="text-decoration: underline;">${escapeHtml(contrib.mobile)}</a></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Email Address</span>
          <div>${escapeHtml(contrib.email || 'None provided')}</div>
        </div>
        <div>
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Contribution Tier</span>
          <div style="font-weight: 500;">${escapeHtml(contrib.contribution_type)}${contrib.is_custom ? ' (Custom Amount)' : ''}</div>
        </div>
      </div>

      <div style="border-top: 1px dashed var(--line); padding-top: 14px; margin-top: 14px;">
        <span style="color: var(--mute); font-size: 11px; text-transform: uppercase;">Payment Details</span>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
          <span>Contribution Amount:</span>
          <strong style="color: var(--teal); font-size: 18px;">₹${Number(contrib.amount).toLocaleString('en-IN')}</strong>
        </div>

        ${contrib.transaction_id ? `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; background: rgba(0,0,0,0.2); padding: 10px 14px; border-radius: 10px; border: 1px solid var(--line);">
            <div>
              <div style="font-size: 11px; color: var(--mute); text-transform: uppercase;">Legacy UPI Ref / UTR</div>
              <code style="font-size: 15px; font-weight: bold; color: var(--yel);">${escapeHtml(contrib.transaction_id)}</code>
            </div>
            <button type="button" class="btn btn-sm" onclick="navigator.clipboard.writeText('${escapeHtml(contrib.transaction_id)}').then(()=>showToast('Copied UTR!'))">📋 Copy</button>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px;">
          <span>Submitted On:</span>
          <span style="color: var(--mute);">${dateStr}</span>
        </div>
      </div>

      <div style="margin-top: 16px; border-top: 1px dashed var(--line); padding-top: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: var(--mute); font-size: 11px; text-transform: uppercase; font-weight: 700;">Payment Screenshot Proof</span>
          ${screenshotUrl ? `<a href="${screenshotUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="text-decoration: none; font-size: 11px; padding: 3px 10px;">🔍 Open Full Size ↗</a>` : ''}
        </div>
        ${screenshotUrl ? `
          <div style="text-align: center; background: rgba(0,0,0,0.4); border: 1px solid var(--line); border-radius: 12px; padding: 10px;">
            <a href="${screenshotUrl}" target="_blank" rel="noopener noreferrer" title="Click to view full image in new tab">
              <img src="${screenshotUrl}" alt="Proof for ${contrib.contribution_id}" style="max-height: 280px; max-width: 100%; border-radius: 8px; object-fit: contain; cursor: zoom-in; display: block; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.3);" />
            </a>
            <div style="font-size: 11px; color: var(--mute); margin-top: 8px;">
              Path: <code>${escapeHtml(contrib.payment_screenshot_path || 'uploaded')}</code> · Click image to expand
            </div>
          </div>
        ` : `
          <div style="padding: 18px; text-align: center; background: rgba(0,0,0,0.03); border: 1px dashed var(--line); border-radius: 10px; color: var(--mute); font-size: 13px;">
            📷 No payment screenshot available.
          </div>
        `}
      </div>
    `;

    document.getElementById('modal-contrib-btn-verify').onclick = () => confirmVerifyContribution(contrib.id);
    document.getElementById('modal-contrib-btn-reject').onclick = () => confirmRejectContribution(contrib.id);
    document.getElementById('modal-contrib-btn-delete').onclick = () => confirmDeleteContribution(contrib.id);

    modal.showModal();
  }
  window.openContributionDetails = openContributionDetails;

  async function confirmVerifyContribution(id) {
    const contrib = allContributions.find(c => c.id === id);
    if (!contrib) return;

    if (!confirm(`Verify ₹${contrib.amount} UPI contribution for ${contrib.full_name} (${contrib.contribution_id})?\n\nTransaction ID / UTR: ${contrib.transaction_id}`)) {
      return;
    }

    const sb = window.getSupabase();
    try {
      const { error } = await sb.from('contributions').update({
        payment_status: 'VERIFIED',
        updated_at: new Date().toISOString()
      }).eq('id', id);

      if (error) throw error;
      showToast(`Contribution ${contrib.contribution_id} marked as VERIFIED!`);
      const modal = document.getElementById('contrib-detail-modal');
      if (modal && modal.open) modal.close();
      await loadContributions();
    } catch (err) {
      alert('Verification error: ' + err.message);
    }
  }
  window.confirmVerifyContribution = confirmVerifyContribution;

  async function confirmRejectContribution(id) {
    const contrib = allContributions.find(c => c.id === id);
    if (!contrib) return;

    if (!confirm(`Mark payment as REJECTED for ${contrib.full_name} (${contrib.contribution_id})?\n\nTransaction ID / UTR: ${contrib.transaction_id}`)) {
      return;
    }

    const sb = window.getSupabase();
    try {
      const { error } = await sb.from('contributions').update({
        payment_status: 'REJECTED',
        updated_at: new Date().toISOString()
      }).eq('id', id);

      if (error) throw error;
      showToast(`Contribution ${contrib.contribution_id} marked as REJECTED.`);
      const modal = document.getElementById('contrib-detail-modal');
      if (modal && modal.open) modal.close();
      await loadContributions();
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  }
  window.confirmRejectContribution = confirmRejectContribution;

  function confirmDeleteContribution(id) {
    const contrib = allContributions.find(c => c.id === id);
    if (!contrib) return;

    contribToDelete = contrib;

    const detailModal = document.getElementById('contrib-detail-modal');
    if (detailModal && detailModal.open) detailModal.close();

    const deleteModal = document.getElementById('contrib-delete-modal');
    document.getElementById('delete-contrib-id').textContent = contrib.contribution_id;
    document.getElementById('delete-contrib-name').textContent = `${contrib.full_name} · ${contrib.mobile}`;
    document.getElementById('delete-contrib-amount').textContent = `Amount: ₹${contrib.amount} (${contrib.contribution_type})`;

    document.getElementById('confirm-contrib-delete-btn').onclick = async () => {
      const sb = window.getSupabase();
      try {
        const { error } = await sb.from('contributions').delete().eq('id', contrib.id);
        if (error) throw error;
        showToast(`Contribution ${contrib.contribution_id} deleted permanently.`);
        deleteModal.close();
        contribToDelete = null;
        await loadContributions();
      } catch (err) {
        alert('Deletion error: ' + err.message);
      }
    };

    deleteModal.showModal();
  }
  window.confirmDeleteContribution = confirmDeleteContribution;

  // -------------------------------------------------------------
  // GALLERY MANAGEMENT
  // -------------------------------------------------------------
  async function loadGallery() {
    const sb = window.getSupabase();
    if (!sb) return;
    try {
      const { data, error } = await sb.from('gallery_items')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      allGalleryItems = data || [];
      renderGallery();
    } catch (err) {
      console.warn('Load gallery error:', err);
    }
  }

  function renderGallery() {
    // 1. Stats
    const totalEl = document.getElementById('stat-gallery-total');
    const pubEl = document.getElementById('stat-gallery-published');
    const hidEl = document.getElementById('stat-gallery-hidden');
    const featEl = document.getElementById('stat-gallery-featured');

    const total = allGalleryItems.length;
    const published = allGalleryItems.filter(i => i.published).length;
    const hidden = allGalleryItems.filter(i => !i.published).length;
    const featuredItem = allGalleryItems.find(i => i.featured);

    if (totalEl) totalEl.textContent = total;
    if (pubEl) pubEl.textContent = published;
    if (hidEl) hidEl.textContent = hidden;
    if (featEl) featEl.textContent = featuredItem ? featuredItem.title : 'None Selected';

    // 2. Filters
    const searchVal = (document.getElementById('gallery-search-input')?.value || '').toLowerCase().trim();
    const catVal = document.getElementById('gallery-filter-cat')?.value || 'all';
    const statusVal = document.getElementById('gallery-filter-status')?.value || 'all';

    let filtered = allGalleryItems.filter(item => {
      // Search match
      if (searchVal) {
        const titleMatch = (item.title || '').toLowerCase().includes(searchVal);
        const descMatch = (item.description || '').toLowerCase().includes(searchVal);
        if (!titleMatch && !descMatch) return false;
      }
      // Category match
      if (catVal !== 'all' && item.category !== catVal) {
        return false;
      }
      // Status match
      if (statusVal === 'published' && !item.published) return false;
      if (statusVal === 'hidden' && item.published) return false;
      if (statusVal === 'featured' && !item.featured) return false;

      return true;
    });

    // 3. Render Table
    const tbody = document.getElementById('gallery-library-tbody');
    const countInfo = document.getElementById('gallery-count-info');
    if (countInfo) countInfo.textContent = `Showing ${filtered.length} of ${total} images`;

    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--mute); padding: 24px;">No gallery images matching your filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      return `
        <tr>
          <td>
            <a href="${item.image_url}" target="_blank" rel="noopener">
              <img src="${item.image_url}" alt="${escapeHtml(item.title)}" style="width: 70px; height: 50px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line);">
            </a>
          </td>
          <td>
            <strong style="display: block; font-size: 13px;">${escapeHtml(item.title)}</strong>
            <small style="color: var(--mute);">${escapeHtml(item.description || 'No caption')}</small>
          </td>
          <td>
            <span class="badge" style="font-size: 11px;">${escapeHtml(item.category || 'Events')}</span>
          </td>
          <td>
            ${item.published ? '<span class="badge confirmed">Published</span>' : '<span class="badge" style="color: var(--mute);">Hidden</span>'}
          </td>
          <td>
            ${item.featured ? '<span class="badge" style="background: rgba(208,2,27,0.15); color: var(--red); font-weight: bold; border: 1px solid var(--red);">★ LANDING PAGE</span>' : '<span style="color: var(--mute); font-size: 11px;">Standard</span>'}
          </td>
          <td style="font-size: 11px; color: var(--mute);">${dateStr}</td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="btn btn-sm" onclick="openEditGalleryModal('${item.id}')" title="Edit details">
                ✏️ Edit
              </button>
              <button type="button" class="btn btn-sm" onclick="toggleGalleryPublish('${item.id}', ${item.published})">
                ${item.published ? '👁️ Hide' : '✓ Publish'}
              </button>
              ${!item.featured ? `
                <button type="button" class="btn btn-sm secondary" onclick="setGalleryFeatured('${item.id}')" title="Set as Featured Landing Image">
                  ★ Make Featured
                </button>
              ` : ''}
              <button type="button" class="btn btn-sm danger" onclick="openDeleteGalleryModal('${item.id}')">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Gallery File Preview
  const galleryFileInput = document.getElementById('gallery-file-input');
  if (galleryFileInput) {
    galleryFileInput.onchange = () => {
      const file = galleryFileInput.files[0];
      if (file) {
        const previewImg = document.getElementById('gallery-preview-img');
        const filenameLabel = document.getElementById('gallery-preview-filename');
        if (previewImg) previewImg.src = URL.createObjectURL(file);
        if (filenameLabel) filenameLabel.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        const previewBox = document.getElementById('gallery-preview-box');
        if (previewBox) previewBox.style.display = 'block';
      }
    };
  }

  // Gallery Upload Submit
  const uploadGalleryBtn = document.getElementById('upload-gallery-btn');
  if (uploadGalleryBtn) {
    uploadGalleryBtn.onclick = async () => {
      const file = galleryFileInput?.files[0];
      const title = document.getElementById('gallery-title-input')?.value.trim();
      const desc = document.getElementById('gallery-desc-input')?.value.trim();
      const category = document.getElementById('gallery-category-select')?.value || 'Events';
      const displayOrder = parseInt(document.getElementById('gallery-order-input')?.value) || 0;
      const published = document.getElementById('gallery-published-cb')?.checked ?? true;
      const featured = document.getElementById('gallery-featured-cb')?.checked ?? false;

      if (!file) {
        alert('Please choose an image file to upload.');
        return;
      }
      if (!title) {
        alert('Please enter a title for the gallery image.');
        document.getElementById('gallery-title-input').focus();
        return;
      }

      uploadGalleryBtn.disabled = true;
      uploadGalleryBtn.innerHTML = '<span>Uploading Image...</span>';

      const sb = window.getSupabase();
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `gallery_${Date.now()}.${fileExt}`;
        let filePath = `images/${fileName}`;
        let bucketName = 'hlf-gallery';

        // Upload to hlf-gallery bucket with fallback to hlf-posters
        let { error: uploadError } = await sb.storage.from(bucketName).upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

        if (uploadError) {
          console.warn('hlf-gallery upload fallback:', uploadError);
          bucketName = 'hlf-posters';
          filePath = `gallery/${fileName}`;
          const { error: fallbackError } = await sb.storage.from(bucketName).upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });
          if (fallbackError) throw uploadError;
        }

        const { data: { publicUrl } } = sb.storage.from(bucketName).getPublicUrl(filePath);

        // Unset previous featured before insert
        if (featured) {
          await sb.from('gallery_items').update({ featured: false }).neq('id', '00000000-0000-0000-0000-000000000000');
        }

        // Insert into gallery_items
        const { error: insertError } = await sb.from('gallery_items').insert({
          title,
          description: desc,
          image_url: publicUrl,
          storage_path: filePath,
          category,
          published,
          featured,
          display_order: displayOrder
        });

        if (insertError) throw insertError;

        showToast(featured ? 'Image uploaded & set as FEATURED on homepage hero!' : 'Image added to Gallery!');

        // Reset form
        galleryFileInput.value = '';
        document.getElementById('gallery-title-input').value = '';
        document.getElementById('gallery-desc-input').value = '';
        document.getElementById('gallery-order-input').value = '0';
        document.getElementById('gallery-featured-cb').checked = false;
        document.getElementById('gallery-preview-box').style.display = 'none';

        await loadGallery();
      } catch (err) {
        console.error('Gallery upload error:', err);
        alert('Upload failed: ' + err.message);
      } finally {
        uploadGalleryBtn.disabled = false;
        uploadGalleryBtn.innerHTML = '<span>🚀 Upload & Save to Gallery</span>';
      }
    };
  }

  // Edit Gallery Modal
  function openEditGalleryModal(id) {
    const item = allGalleryItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('edit-gallery-id').value = item.id;
    document.getElementById('edit-gallery-title').value = item.title;
    document.getElementById('edit-gallery-desc').value = item.description || '';
    document.getElementById('edit-gallery-cat').value = item.category || 'Events';
    document.getElementById('edit-gallery-order').value = item.display_order || 0;
    document.getElementById('edit-gallery-published').checked = !!item.published;
    document.getElementById('edit-gallery-featured').checked = !!item.featured;
    document.getElementById('edit-gallery-preview').src = item.image_url;

    document.getElementById('gallery-edit-modal').showModal();
  }
  window.openEditGalleryModal = openEditGalleryModal;

  const galleryEditForm = document.getElementById('gallery-edit-form');
  if (galleryEditForm) {
    galleryEditForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-gallery-id').value;
      const title = document.getElementById('edit-gallery-title').value.trim();
      const desc = document.getElementById('edit-gallery-desc').value.trim();
      const category = document.getElementById('edit-gallery-cat').value;
      const displayOrder = parseInt(document.getElementById('edit-gallery-order').value) || 0;
      const published = document.getElementById('edit-gallery-published').checked;
      const featured = document.getElementById('edit-gallery-featured').checked;

      if (!title) {
        alert('Please enter a title.');
        return;
      }

      const sb = window.getSupabase();
      try {
        // Unset previous featured before update
        if (featured) {
          await sb.from('gallery_items').update({ featured: false }).neq('id', id);
        }

        const { error } = await sb.from('gallery_items').update({
          title,
          description: desc,
          category,
          display_order: displayOrder,
          published,
          featured,
          updated_at: new Date().toISOString()
        }).eq('id', id);

        if (error) throw error;

        showToast(featured ? 'Gallery item updated & set as FEATURED on homepage!' : 'Gallery item updated successfully!');
        document.getElementById('gallery-edit-modal').close();
        await loadGallery();
      } catch (err) {
        alert('Update error: ' + err.message);
      }
    };
  }

  // Toggle Publish
  async function toggleGalleryPublish(id, currentPublished) {
    const sb = window.getSupabase();
    try {
      const nextStatus = !currentPublished;
      const { error } = await sb.from('gallery_items').update({
        published: nextStatus,
        updated_at: new Date().toISOString()
      }).eq('id', id);

      if (error) throw error;
      showToast(nextStatus ? 'Image is now Published publicly' : 'Image is now Hidden from public');
      await loadGallery();
    } catch (err) {
      alert('Status update error: ' + err.message);
    }
  }
  window.toggleGalleryPublish = toggleGalleryPublish;

  // Set Featured Landing Image
  async function setGalleryFeatured(id) {
    const item = allGalleryItems.find(i => i.id === id);
    if (!item) return;

    if (!confirm(`Set "${item.title}" as the Primary Featured Image on the homepage landing section?`)) {
      return;
    }

    const sb = window.getSupabase();
    try {
      // Automatically unset any previous featured image
      await sb.from('gallery_items').update({ featured: false }).neq('id', id);

      const { error } = await sb.from('gallery_items').update({
        featured: true,
        published: true,
        updated_at: new Date().toISOString()
      }).eq('id', id);

      if (error) throw error;
      showToast(`★ "${item.title}" is now the Featured Landing Image!`);
      await loadGallery();
    } catch (err) {
      alert('Error setting featured image: ' + err.message);
    }
  }
  window.setGalleryFeatured = setGalleryFeatured;

  // Delete Gallery Modal
  let itemToDelete = null;
  function openDeleteGalleryModal(id) {
    const item = allGalleryItems.find(i => i.id === id);
    if (!item) return;

    itemToDelete = item;
    document.getElementById('delete-gallery-title').textContent = item.title;
    document.getElementById('delete-gallery-cat').textContent = `${item.category} · ${item.published ? 'Published' : 'Hidden'}`;
    document.getElementById('delete-gallery-preview').src = item.image_url;
    document.getElementById('gallery-delete-modal').showModal();
  }
  window.openDeleteGalleryModal = openDeleteGalleryModal;

  const confirmDeleteBtn = document.getElementById('confirm-gallery-delete-btn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = async () => {
      if (!itemToDelete) return;
      const sb = window.getSupabase();
      confirmDeleteBtn.disabled = true;

      try {
        const { error: dbErr } = await sb.from('gallery_items').delete().eq('id', itemToDelete.id);
        if (dbErr) throw dbErr;

        if (itemToDelete.storage_path) {
          try {
            await sb.storage.from('hlf-gallery').remove([itemToDelete.storage_path]);
          } catch (e) { }
        }

        showToast(`Deleted "${itemToDelete.title}" from Gallery.`);
        document.getElementById('gallery-delete-modal').close();
        itemToDelete = null;
        await loadGallery();
      } catch (err) {
        alert('Delete error: ' + err.message);
      } finally {
        confirmDeleteBtn.disabled = false;
      }
    };
  }

  // Bind gallery filter listeners
  const gSearch = document.getElementById('gallery-search-input');
  if (gSearch) gSearch.oninput = renderGallery;
  const gCat = document.getElementById('gallery-filter-cat');
  if (gCat) gCat.onchange = renderGallery;
  const gStat = document.getElementById('gallery-filter-status');
  if (gStat) gStat.onchange = renderGallery;

  // -------------------------------------------------------------
  // POSTER MANAGEMENT
  // -------------------------------------------------------------
  async function loadPosters() {
    const sb = window.getSupabase();
    try {
      const { data, error } = await sb.from('posters').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allPosters = data || [];
      renderPostersGrid();
    } catch (err) {
      console.warn('Load posters error:', err);
    }
  }

  function renderPostersGrid() {
    const container = document.getElementById('posters-library-grid');
    if (allPosters.length === 0) {
      container.innerHTML = `<p style="color: var(--mute);">No posters uploaded yet.</p>`;
      return;
    }

    container.innerHTML = allPosters.map(p => `
      <div style="display: flex; gap: 14px; align-items: center; padding: 12px; border-radius: 14px; border: 1px solid var(--line); background: var(--card);">
        <img src="${p.image_url || 'assets/hlf-upi-qr.png'}" alt="${escapeHtml(p.title)}" style="width: 70px; height: 90px; object-fit: cover; border-radius: 8px;">
        <div style="flex: 1;">
          <div style="font-weight: bold;">${escapeHtml(p.title)}</div>
          <div style="font-size: 11px; color: var(--mute); margin: 3px 0;">${escapeHtml(p.description || '')}</div>
          <div>
            ${p.is_active ? '<span class="badge confirmed">ACTIVE ON WEBSITE</span>' : '<span class="badge">Inactive</span>'}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${!p.is_active ? `<button class="btn btn-sm secondary" onclick="setActivePoster('${p.id}')">Set Active</button>` : ''}
          <button class="btn btn-sm danger" onclick="deletePoster('${p.id}', '${p.storage_path}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  // Preview Poster
  const posterInput = document.getElementById('poster-file-input');
  posterInput.onchange = () => {
    const file = posterInput.files[0];
    if (file) {
      const previewImg = document.getElementById('poster-preview-img');
      previewImg.src = URL.createObjectURL(file);
      document.getElementById('poster-preview-box').style.display = 'block';
    }
  };

  // Upload Poster
  document.getElementById('upload-poster-btn').onclick = async () => {
    const file = posterInput.files[0];
    const title = document.getElementById('poster-title-input').value.trim();
    const desc = document.getElementById('poster-desc-input').value.trim();
    const setActive = document.getElementById('poster-set-active-cb').checked;

    if (!file) {
      alert('Please select an image file to upload.');
      return;
    }
    if (!title) {
      alert('Please enter a title for the poster.');
      return;
    }

    const btn = document.getElementById('upload-poster-btn');
    btn.disabled = true;
    btn.textContent = 'Uploading to Storage...';

    const sb = window.getSupabase();
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `poster_${Date.now()}.${fileExt}`;
      const filePath = `posters/${fileName}`;

      // Upload to bucket
      const { error: uploadError } = await sb.storage.from('hlf-posters').upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = sb.storage.from('hlf-posters').getPublicUrl(filePath);

      // Deactivate other posters if this one is active
      if (setActive) {
        await sb.from('posters').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Insert record
      const { error: insertErr } = await sb.from('posters').insert({
        title,
        description: desc,
        image_url: publicUrl,
        storage_path: filePath,
        is_active: setActive
      });
      if (insertErr) throw insertErr;

      showToast('Poster uploaded and configured successfully!');
      posterInput.value = '';
      document.getElementById('poster-title-input').value = '';
      document.getElementById('poster-desc-input').value = '';
      document.getElementById('poster-preview-box').style.display = 'none';

      await loadPosters();
    } catch (err) {
      console.error('Poster upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 Upload Poster';
    }
  };

  async function setActivePoster(posterId) {
    const sb = window.getSupabase();
    try {
      // Unset all
      await sb.from('posters').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      // Set chosen
      await sb.from('posters').update({ is_active: true }).eq('id', posterId);
      showToast('Poster is now active on the public website!');
      await loadPosters();
    } catch (err) {
      alert('Failed to set active poster: ' + err.message);
    }
  }
  window.setActivePoster = setActivePoster;

  async function deletePoster(posterId, storagePath) {
    if (!confirm('Are you sure you want to delete this poster?')) return;
    const sb = window.getSupabase();
    try {
      if (storagePath) {
        await sb.storage.from('hlf-posters').remove([storagePath]);
      }
      await sb.from('posters').delete().eq('id', posterId);
      showToast('Poster deleted successfully.');
      await loadPosters();
    } catch (err) {
      alert('Failed to delete poster: ' + err.message);
    }
  }
  window.deletePoster = deletePoster;

  // -------------------------------------------------------------
  // EVENT UPDATES MANAGEMENT
  // -------------------------------------------------------------
  async function loadUpdates() {
    const sb = window.getSupabase();
    try {
      const { data, error } = await sb.from('event_updates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allUpdates = data || [];
      renderUpdatesTable();
    } catch (err) {
      console.warn('Load updates error:', err);
    }
  }

  function renderUpdatesTable() {
    const tbody = document.getElementById('updates-tbody');
    if (allUpdates.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--mute);">No updates added yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allUpdates.map(u => `
      <tr>
        <td><strong>${escapeHtml(u.title)}</strong><br><small style="color: var(--mute);">${escapeHtml(u.description || '')}</small></td>
        <td><span class="badge">${escapeHtml(u.category || 'General')}</span></td>
        <td>${escapeHtml(u.date || '')}</td>
        <td>${u.is_published ? '<span class="badge confirmed">Published</span>' : '<span class="badge">Draft</span>'}</td>
        <td>
          <button class="btn btn-sm" onclick="editUpdate('${u.id}')">✏️ Edit</button>
          <button class="btn btn-sm danger" onclick="deleteUpdate('${u.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('open-new-update-btn').onclick = () => {
    document.getElementById('update-modal-title').textContent = 'New Event Update';
    document.getElementById('edit-update-id').value = '';
    document.getElementById('edit-update-title').value = '';
    document.getElementById('edit-update-category').value = 'Festival';
    document.getElementById('edit-update-date').value = '18–20 Oct 2026';
    document.getElementById('edit-update-desc').value = '';
    document.getElementById('edit-update-published').checked = true;
    document.getElementById('update-modal').showModal();
  };

  function editUpdate(id) {
    const u = allUpdates.find(x => x.id === id);
    if (!u) return;
    document.getElementById('update-modal-title').textContent = 'Edit Event Update';
    document.getElementById('edit-update-id').value = u.id;
    document.getElementById('edit-update-title').value = u.title;
    document.getElementById('edit-update-category').value = u.category || 'General';
    document.getElementById('edit-update-date').value = u.date || '';
    document.getElementById('edit-update-desc').value = u.description || '';
    document.getElementById('edit-update-published').checked = u.is_published !== false;
    document.getElementById('update-modal').showModal();
  }
  window.editUpdate = editUpdate;

  document.getElementById('update-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-update-id').value;
    const title = document.getElementById('edit-update-title').value.trim();
    const category = document.getElementById('edit-update-category').value.trim();
    const date = document.getElementById('edit-update-date').value.trim();
    const description = document.getElementById('edit-update-desc').value.trim();
    const is_published = document.getElementById('edit-update-published').checked;

    const sb = window.getSupabase();
    try {
      if (id) {
        await sb.from('event_updates').update({ title, category, date, description, is_published, updated_at: new Date().toISOString() }).eq('id', id);
        showToast('Update saved successfully!');
      } else {
        await sb.from('event_updates').insert({ title, category, date, description, is_published });
        showToast('New event update created!');
      }
      document.getElementById('update-modal').close();
      await loadUpdates();
    } catch (err) {
      alert('Error saving update: ' + err.message);
    }
  };

  async function deleteUpdate(id) {
    if (!confirm('Are you sure you want to delete this event update?')) return;
    const sb = window.getSupabase();
    try {
      await sb.from('event_updates').delete().eq('id', id);
      showToast('Event update deleted.');
      await loadUpdates();
    } catch (err) {
      alert('Delete error: ' + err.message);
    }
  }
  window.deleteUpdate = deleteUpdate;

  // -------------------------------------------------------------
  // ANNOUNCEMENTS MANAGEMENT
  // -------------------------------------------------------------
  async function loadAnnouncements() {
    const sb = window.getSupabase();
    try {
      const { data, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allAnnouncements = data || [];
      renderAnnouncementsTable();
    } catch (err) {
      console.warn('Load announcements error:', err);
    }
  }

  function renderAnnouncementsTable() {
    const tbody = document.getElementById('announcements-tbody');
    if (allAnnouncements.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--mute);">No announcements added.</td></tr>`;
      return;
    }

    tbody.innerHTML = allAnnouncements.map(a => `
      <tr>
        <td><span class="badge primary">${escapeHtml(a.badge_text || 'NOTICE')}</span></td>
        <td><strong>${escapeHtml(a.title)}</strong><br><small style="color: var(--mute);">${escapeHtml(a.content || '')}</small></td>
        <td>${a.is_priority ? '<strong style="color: var(--red);">Priority</strong>' : 'Normal'}</td>
        <td>${a.is_active ? '<span class="badge confirmed">Active</span>' : '<span class="badge">Inactive</span>'}</td>
        <td>
          <button class="btn btn-sm" onclick="editAnnouncement('${a.id}')">✏️</button>
          <button class="btn btn-sm danger" onclick="deleteAnnouncement('${a.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('open-new-announcement-btn').onclick = () => {
    document.getElementById('announcement-modal-title').textContent = 'New Announcement';
    document.getElementById('edit-announcement-id').value = '';
    document.getElementById('edit-ann-badge').value = 'OFFICIAL';
    document.getElementById('edit-ann-title').value = '';
    document.getElementById('edit-ann-content').value = '';
    document.getElementById('edit-ann-link').value = '';
    document.getElementById('edit-ann-active').checked = true;
    document.getElementById('edit-ann-priority').checked = false;
    document.getElementById('announcement-modal').showModal();
  };

  function editAnnouncement(id) {
    const a = allAnnouncements.find(x => x.id === id);
    if (!a) return;
    document.getElementById('announcement-modal-title').textContent = 'Edit Announcement';
    document.getElementById('edit-announcement-id').value = a.id;
    document.getElementById('edit-ann-badge').value = a.badge_text || 'OFFICIAL';
    document.getElementById('edit-ann-title').value = a.title || '';
    document.getElementById('edit-ann-content').value = a.content || '';
    document.getElementById('edit-ann-link').value = a.link_url || '';
    document.getElementById('edit-ann-active').checked = a.is_active !== false;
    document.getElementById('edit-ann-priority').checked = !!a.is_priority;
    document.getElementById('announcement-modal').showModal();
  }
  window.editAnnouncement = editAnnouncement;

  document.getElementById('announcement-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-announcement-id').value;
    const badge_text = document.getElementById('edit-ann-badge').value.trim();
    const title = document.getElementById('edit-ann-title').value.trim();
    const content = document.getElementById('edit-ann-content').value.trim();
    const link_url = document.getElementById('edit-ann-link').value.trim();
    const is_active = document.getElementById('edit-ann-active').checked;
    const is_priority = document.getElementById('edit-ann-priority').checked;

    const sb = window.getSupabase();
    try {
      if (id) {
        await sb.from('announcements').update({ badge_text, title, content, link_url, is_active, is_priority }).eq('id', id);
        showToast('Announcement saved!');
      } else {
        await sb.from('announcements').insert({ badge_text, title, content, link_url, is_active, is_priority });
        showToast('New announcement created!');
      }
      document.getElementById('announcement-modal').close();
      await loadAnnouncements();
    } catch (err) {
      alert('Error saving announcement: ' + err.message);
    }
  };

  async function deleteAnnouncement(id) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    const sb = window.getSupabase();
    try {
      await sb.from('announcements').delete().eq('id', id);
      showToast('Announcement deleted.');
      await loadAnnouncements();
    } catch (err) {
      alert('Delete error: ' + err.message);
    }
  }
  window.deleteAnnouncement = deleteAnnouncement;

  // -------------------------------------------------------------
  // PROGRAMME & SCHEDULE MANAGEMENT SYSTEM
  // -------------------------------------------------------------
  let allProgrammeDays = [];
  let allProgrammePeople = [];
  let currentSessionParticipants = [];
  let currentProgView = 'cards';

  async function loadProgramme() {
    const sb = window.getSupabase();
    if (!sb) return;
    try {
      const [daysRes, itemsRes, peopleRes] = await Promise.all([
        sb.from('programme_days').select('*').order('display_order', { ascending: true }),
        sb.from('programme_items').select('*').order('day_number', { ascending: true }).order('display_order', { ascending: true }).order('sort_order', { ascending: true }),
        sb.from('programme_people').select('*').order('name', { ascending: true })
      ]);

      if (daysRes.error) console.warn('Load programme_days error:', daysRes.error);
      if (itemsRes.error) console.warn('Load programme_items error:', itemsRes.error);
      if (peopleRes.error) console.warn('Load programme_people error:', peopleRes.error);

      allProgrammeDays = daysRes.data || [];
      allProgramme = itemsRes.data || [];
      allProgrammePeople = peopleRes.data || [];

      updateDaySelectOptions();
      updatePeopleDatalist();

      renderProgrammeDays();
      renderProgrammeSessions();
    } catch (err) {
      console.warn('Load programme error:', err);
    }
  }
  window.loadProgramme = loadProgramme;

  function updatePeopleDatalist() {
    const datalist = document.getElementById('all-people-datalist');
    if (!datalist) return;
    datalist.innerHTML = allProgrammePeople.map(p => `<option value="${escapeHtml(p.name)}">`).join('');
  }

  function updateDaySelectOptions() {
    const daySelect = document.getElementById('edit-session-day');
    if (daySelect && allProgrammeDays.length > 0) {
      daySelect.innerHTML = allProgrammeDays.map(d => `
        <option value="${d.day_number}" data-date="${d.date}">Day 0${d.day_number} (${escapeHtml(d.date)} — ${escapeHtml(d.day_name)})</option>
      `).join('');
    }

    const dayFilter = document.getElementById('prog-day-filter');
    if (dayFilter && allProgrammeDays.length > 0) {
      const currentVal = dayFilter.value;
      dayFilter.innerHTML = `
        <option value="all">All Days (${allProgramme.length} sessions)</option>
        ${allProgrammeDays.map(d => {
        const count = allProgramme.filter(p => p.day_number === d.day_number || p.day_id === d.id).length;
        return `<option value="${d.day_number}">Day 0${d.day_number} (${escapeHtml(d.date)} · ${count} sessions)</option>`;
      }).join('')}
      `;
      if (currentVal) dayFilter.value = currentVal;
    }
  }

  // DAY MANAGEMENT
  function renderProgrammeDays() {
    const container = document.getElementById('programme-days-container');
    if (!container) return;

    if (allProgrammeDays.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--mute); border: 1px dashed var(--line); border-radius: 14px;">
          No festival days found. Click "+ Add Day" to create one.
        </div>
      `;
      return;
    }

    container.innerHTML = allProgrammeDays.map(d => {
      const daySessions = allProgramme.filter(p => p.day_number === d.day_number || p.day_id === d.id);
      const isPub = d.is_published !== false;
      return `
        <div class="stat-card" style="border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; background: var(--card);">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="badge" style="background: rgba(208, 2, 27, 0.15); color: var(--red);">DAY 0${d.day_number}</span>
              <span class="badge" style="background: ${isPub ? 'rgba(18, 144, 122, 0.15)' : 'rgba(255, 255, 255, 0.1)'}; color: ${isPub ? 'var(--teal)' : 'var(--mute)'};">
                ${isPub ? '● Published' : '○ Draft'}
              </span>
            </div>
            <h4 style="margin: 0 0 4px; font-size: 1.1rem; color: var(--ink);">${escapeHtml(d.day_name)}</h4>
            <div style="font-size: 12px; color: var(--mute); margin-bottom: 8px;">📅 ${escapeHtml(d.date)}</div>
            <div style="font-size: 12px; color: var(--teal); font-weight: 600;">✦ ${daySessions.length} Sessions</div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 14px; border-top: 1px solid var(--line); padding-top: 10px;">
            <button class="btn btn-sm" onclick="openEditDay('${d.id}')" style="flex: 1; justify-content: center;">✏️ Edit</button>
            <button class="btn btn-sm" onclick="openNewSessionForDay(${d.day_number})" style="flex: 1; justify-content: center; color: var(--teal);">+ Add Session</button>
            <button class="btn btn-sm danger" onclick="deleteDay('${d.id}')" title="Delete Day">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function openNewDay() {
    const nextDayNum = allProgrammeDays.length > 0 ? Math.max(...allProgrammeDays.map(d => d.day_number || 0)) + 1 : 1;
    document.getElementById('day-modal-title').textContent = 'Add Festival Day';
    document.getElementById('edit-day-id').value = '';
    document.getElementById('edit-day-number').value = nextDayNum;
    document.getElementById('edit-day-date').value = `2026-10-${17 + nextDayNum}`;
    document.getElementById('edit-day-name').value = '';
    document.getElementById('edit-day-order').value = nextDayNum;
    document.getElementById('edit-day-published').checked = true;
    document.getElementById('day-modal').showModal();
  }
  window.openNewDay = openNewDay;

  function openEditDay(dayId) {
    const d = allProgrammeDays.find(x => x.id === dayId);
    if (!d) return;
    document.getElementById('day-modal-title').textContent = `Edit Day 0${d.day_number}`;
    document.getElementById('edit-day-id').value = d.id;
    document.getElementById('edit-day-number').value = d.day_number;
    document.getElementById('edit-day-date').value = d.date;
    document.getElementById('edit-day-name').value = d.day_name;
    document.getElementById('edit-day-order').value = d.display_order ?? d.day_number;
    document.getElementById('edit-day-published').checked = d.is_published !== false;
    document.getElementById('day-modal').showModal();
  }
  window.openEditDay = openEditDay;

  const dayForm = document.getElementById('day-form');
  if (dayForm) {
    dayForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-day-id').value;
      const day_number = parseInt(document.getElementById('edit-day-number').value, 10);
      const date = document.getElementById('edit-day-date').value;
      const day_name = document.getElementById('edit-day-name').value.trim();
      const display_order = parseInt(document.getElementById('edit-day-order').value, 10) || day_number;
      const is_published = document.getElementById('edit-day-published').checked;

      const sb = window.getSupabase();
      try {
        if (id) {
          const { error } = await sb.from('programme_days').update({
            day_number, date, day_name, display_order, is_published, updated_at: new Date().toISOString()
          }).eq('id', id);
          if (error) throw error;
          showToast('Festival day updated!');
        } else {
          const { error } = await sb.from('programme_days').insert({
            day_number, date, day_name, display_order, is_published
          });
          if (error) throw error;
          showToast('New festival day created!');
        }
        document.getElementById('day-modal').close();
        await loadProgramme();
      } catch (err) {
        alert('Day save error: ' + err.message);
      }
    };
  }

  async function deleteDay(dayId) {
    const d = allProgrammeDays.find(x => x.id === dayId);
    if (!d) return;
    const count = allProgramme.filter(p => p.day_number === d.day_number || p.day_id === d.id).length;
    if (count > 0) {
      if (!confirm(`Day 0${d.day_number} currently has ${count} session(s). Deleting this day will remove its grouping. Continue?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete Day 0${d.day_number} (${d.day_name})?`)) return;
    }

    const sb = window.getSupabase();
    try {
      const { error } = await sb.from('programme_days').delete().eq('id', dayId);
      if (error) throw error;
      showToast('Festival day deleted.');
      await loadProgramme();
    } catch (err) {
      alert('Delete day error: ' + err.message);
    }
  }
  window.deleteDay = deleteDay;

  // SESSION MANAGEMENT
  function renderProgrammeSessions() {
    const filterVal = document.getElementById('prog-day-filter') ? document.getElementById('prog-day-filter').value : 'all';
    const query = document.getElementById('prog-search-input') ? document.getElementById('prog-search-input').value.toLowerCase().trim() : '';

    let list = allProgramme.filter(p => {
      if (filterVal !== 'all' && String(p.day_number) !== filterVal) return false;
      if (query) {
        const text = `${p.title || ''} ${p.subject || ''} ${p.session_number || ''} ${p.speaker || ''} ${p.venue || ''} ${JSON.stringify(p.participants || '')}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });

    renderProgrammeCards(list);
    renderProgrammeTableRows(list);
  }

  function renderProgrammeCards(list) {
    const container = document.getElementById('programme-cards-container');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div style="padding: 30px; text-align: center; color: var(--mute); border: 1px dashed var(--line); border-radius: 16px;">
          No sessions match the selected filter.
        </div>
      `;
      return;
    }

    // Group by Day
    const dayGroups = {};
    list.forEach(p => {
      const dayNum = p.day_number || 1;
      if (!dayGroups[dayNum]) dayGroups[dayNum] = [];
      dayGroups[dayNum].push(p);
    });

    const sortedDayNums = Object.keys(dayGroups).sort((a, b) => Number(a) - Number(b));

    container.innerHTML = sortedDayNums.map(dayNum => {
      const dayMeta = allProgrammeDays.find(d => d.day_number === Number(dayNum));
      const dayTitle = dayMeta ? `DAY 0${dayNum} — ${dayMeta.date} (${dayMeta.day_name.toUpperCase()})` : `DAY 0${dayNum}`;
      const sessions = dayGroups[dayNum].sort((a, b) => {
        const ordA = a.display_order ?? a.sort_order ?? 0;
        const ordB = b.display_order ?? b.sort_order ?? 0;
        if (ordA !== ordB) return ordA - ordB;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

      return `
        <div class="day-group" style="background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--line); padding-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="badge" style="background: var(--red); color: #fff;">DAY 0${dayNum}</span>
              <h3 style="margin: 0; font-size: 1.15rem; color: var(--ink);">${escapeHtml(dayTitle)}</h3>
            </div>
            <button type="button" class="btn btn-sm" onclick="openNewSessionForDay(${dayNum})" style="border-color: var(--teal); color: var(--teal);">
              + Add Session to Day ${dayNum}
            </button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${sessions.map(s => {
        const timeStr = `${s.start_time || ''}${s.end_time ? ' – ' + s.end_time : ''}`;
        const parts = Array.isArray(s.participants) ? s.participants : [];
        const isPub = s.is_published !== false;

        // Participant badges
        let partsHtml = '';
        if (parts.length > 0) {
          const roleMap = {};
          parts.forEach(p => {
            const r = p.role || 'Participant';
            if (!roleMap[r]) roleMap[r] = [];
            roleMap[r].push(p.name);
          });
          partsHtml = Object.keys(roleMap).map(role => `
                  <div style="font-size: 12px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                    <span style="font-weight: 700; color: var(--amb); min-width: fit-content;">${escapeHtml(role)}:</span>
                    <span style="color: var(--ink);">${roleMap[role].map(n => `<span style="display: inline-block; padding: 1px 8px; background: rgba(0,0,0,0.05); border: 1px solid var(--line); border-radius: 99px; margin: 2px;">${escapeHtml(n)}</span>`).join('')}</span>
                  </div>
                `).join('');
        }

        return `
                <div style="border: 1px solid var(--line); border-radius: 14px; padding: 16px; background: var(--bg); display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <code style="color: var(--teal); font-weight: 700; font-size: 13px;">${escapeHtml(timeStr)}</code>
                      ${s.session_number ? `<span class="badge" style="background: rgba(208, 2, 27, 0.12); color: var(--red);">${escapeHtml(s.session_number)}</span>` : ''}
                      ${s.session_type ? `<span class="badge" style="background: rgba(18, 144, 122, 0.12); color: var(--teal);">${escapeHtml(s.session_type)}</span>` : ''}
                      <span class="badge" style="background: ${isPub ? 'rgba(95, 168, 58, 0.15)' : 'rgba(255, 255, 255, 0.1)'}; color: ${isPub ? 'var(--grn)' : 'var(--mute)'};">
                        ${isPub ? '● Published' : '○ Draft'}
                      </span>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                      <span style="font-size: 11px; color: var(--mute); margin-right: 4px;">Order: #${s.display_order ?? s.sort_order ?? 0}</span>
                      <button class="btn btn-sm" onclick="editSession('${s.id}')" title="Edit Session">✏️ Edit</button>
                      <button class="btn btn-sm danger" onclick="deleteSession('${s.id}')" title="Delete Session">🗑️</button>
                    </div>
                  </div>

                  <div>
                    <h4 style="margin: 0 0 4px; font-size: 1.15rem; color: var(--ink);">${escapeHtml(s.title)}</h4>
                    ${s.subject ? `<div style="font-size: 13px; color: var(--ink); margin: 4px 0 6px; line-height: 1.4; white-space: pre-line;">📖 <strong>Topic:</strong> ${escapeHtml(s.subject)}</div>` : ''}
                    ${s.description && s.description !== s.subject && s.description !== s.title ? `<div style="font-size: 12px; color: var(--mute); margin-bottom: 6px;">${escapeHtml(s.description)}</div>` : ''}
                  </div>

                  ${partsHtml ? `<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 6px; border-top: 1px dashed var(--line);">${partsHtml}</div>` : ''}

                  <div style="display: flex; gap: 14px; font-size: 11px; color: var(--mute); margin-top: 4px; flex-wrap: wrap;">
                    ${s.venue ? `<span>📍 ${escapeHtml(s.venue)}</span>` : ''}
                    ${s.category ? `<span>🏷️ ${escapeHtml(s.category)}</span>` : ''}
                  </div>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderProgrammeTableRows(list) {
    const tbody = document.getElementById('programme-tbody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--mute);">No sessions found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const parts = Array.isArray(p.participants) ? p.participants : [];
      const partsText = parts.length > 0 ? parts.map(x => `${x.name} (${x.role})`).join(', ') : (p.speaker || '—');
      const isPub = p.is_published !== false;

      return `
        <tr>
          <td><strong>Day 0${p.day_number}</strong></td>
          <td><code>#${p.display_order ?? p.sort_order ?? 0}</code></td>
          <td><code>${escapeHtml(p.start_time || '')} ${p.end_time ? '– ' + escapeHtml(p.end_time) : ''}</code></td>
          <td>
            <strong>${escapeHtml(p.session_number || '—')}</strong><br>
            <span class="badge" style="background: rgba(18, 144, 122, 0.12); color: var(--teal); font-size: 10px;">${escapeHtml(p.session_type || 'Session')}</span>
          </td>
          <td>
            <strong>${escapeHtml(p.title)}</strong>
            ${p.subject ? `<br><small style="color: var(--teal);">${escapeHtml(p.subject)}</small>` : ''}
          </td>
          <td style="max-width: 200px; font-size: 12px;">${escapeHtml(partsText)}</td>
          <td>${escapeHtml(p.venue || '—')}</td>
          <td>
            <span class="badge" style="background: ${isPub ? 'rgba(95, 168, 58, 0.15)' : 'rgba(255, 255, 255, 0.1)'}; color: ${isPub ? 'var(--grn)' : 'var(--mute)'}; font-size: 10px;">
              ${isPub ? 'Published' : 'Draft'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-sm" onclick="editSession('${p.id}')">✏️</button>
              <button class="btn btn-sm danger" onclick="deleteSession('${p.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // View toggle handlers
  const cardsBtn = document.getElementById('prog-view-cards-btn');
  const tableBtn = document.getElementById('prog-view-table-btn');
  const cardsContainer = document.getElementById('programme-cards-container');
  const tableWrapper = document.getElementById('programme-table-wrapper');

  if (cardsBtn && tableBtn && cardsContainer && tableWrapper) {
    cardsBtn.onclick = () => {
      currentProgView = 'cards';
      cardsBtn.style.background = 'var(--card)';
      cardsBtn.style.color = 'inherit';
      tableBtn.style.background = 'transparent';
      tableBtn.style.color = 'var(--mute)';
      cardsContainer.style.display = 'flex';
      tableWrapper.style.display = 'none';
      renderProgrammeSessions();
    };
    tableBtn.onclick = () => {
      currentProgView = 'table';
      tableBtn.style.background = 'var(--card)';
      tableBtn.style.color = 'inherit';
      cardsBtn.style.background = 'transparent';
      cardsBtn.style.color = 'var(--mute)';
      cardsContainer.style.display = 'none';
      tableWrapper.style.display = 'block';
      renderProgrammeSessions();
    };
  }

  const progDayFilter = document.getElementById('prog-day-filter');
  if (progDayFilter) progDayFilter.onchange = renderProgrammeSessions;

  const progSearch = document.getElementById('prog-search-input');
  if (progSearch) progSearch.oninput = renderProgrammeSessions;

  const openNewDayBtn = document.getElementById('open-new-day-btn');
  if (openNewDayBtn) openNewDayBtn.onclick = openNewDay;

  const openNewSessionBtn = document.getElementById('open-new-session-btn');
  if (openNewSessionBtn) {
    openNewSessionBtn.onclick = () => openNewSession();
  }

  function openNewSession(dayNumber = 1) {
    document.getElementById('session-modal-title').textContent = 'Add Programme Session';
    document.getElementById('edit-session-id').value = '';

    const daySelect = document.getElementById('edit-session-day');
    if (daySelect) {
      daySelect.value = String(dayNumber);
      const selectedOpt = daySelect.options[daySelect.selectedIndex];
      if (selectedOpt && selectedOpt.dataset.date) {
        document.getElementById('edit-session-date').value = selectedOpt.dataset.date;
      } else {
        document.getElementById('edit-session-date').value = `2026-10-${17 + dayNumber}`;
      }
    }

    const daySessions = allProgramme.filter(p => p.day_number === dayNumber);
    const nextOrder = daySessions.length + 1;

    document.getElementById('edit-session-number').value = `SESSION 0${nextOrder}`;
    document.getElementById('edit-session-type').value = 'Session';
    document.getElementById('edit-session-title').value = '';
    document.getElementById('edit-session-subject').value = '';
    document.getElementById('edit-session-start').value = '';
    document.getElementById('edit-session-end').value = '';
    document.getElementById('edit-session-venue').value = 'Imam Al-Bukhari Auditorium';
    document.getElementById('edit-session-cat').value = 'Academic Session';
    document.getElementById('edit-session-order').value = nextOrder;
    document.getElementById('edit-session-desc').value = '';
    document.getElementById('edit-session-published').checked = true;

    currentSessionParticipants = [];
    renderModalParticipants();
    document.getElementById('session-modal').showModal();
  }
  window.openNewSession = openNewSession;

  function openNewSessionForDay(dayNumber) {
    openNewSession(dayNumber);
  }
  window.openNewSessionForDay = openNewSessionForDay;

  const editSessionDayEl = document.getElementById('edit-session-day');
  if (editSessionDayEl) {
    editSessionDayEl.addEventListener('change', (e) => {
      const dVal = parseInt(e.target.value, 10);
      const opt = e.target.options[e.target.selectedIndex];
      if (opt && opt.dataset.date) {
        document.getElementById('edit-session-date').value = opt.dataset.date;
      } else {
        const dObj = allProgrammeDays.find(d => d.day_number === dVal);
        if (dObj) document.getElementById('edit-session-date').value = dObj.date;
      }
    });
  }

  function editSession(id) {
    const s = allProgramme.find(x => x.id === id);
    if (!s) return;
    document.getElementById('session-modal-title').textContent = 'Edit Programme Session';
    document.getElementById('edit-session-id').value = s.id;
    document.getElementById('edit-session-day').value = s.day_number || 1;
    document.getElementById('edit-session-date').value = s.date || '2026-10-18';
    document.getElementById('edit-session-number').value = s.session_number || '';
    document.getElementById('edit-session-type').value = s.session_type || 'Session';
    document.getElementById('edit-session-title').value = s.title || '';
    document.getElementById('edit-session-subject').value = s.subject || '';
    document.getElementById('edit-session-start').value = s.start_time || '';
    document.getElementById('edit-session-end').value = s.end_time || '';
    document.getElementById('edit-session-venue').value = s.venue || '';
    document.getElementById('edit-session-cat').value = s.category || '';
    document.getElementById('edit-session-order').value = s.display_order ?? s.sort_order ?? 1;
    document.getElementById('edit-session-desc').value = s.description || '';
    document.getElementById('edit-session-published').checked = s.is_published !== false;

    currentSessionParticipants = Array.isArray(s.participants) ? JSON.parse(JSON.stringify(s.participants)) : [];
    renderModalParticipants();
    document.getElementById('session-modal').showModal();
  }
  window.editSession = editSession;

  // PARTICIPANT MANAGEMENT IN MODAL
  function renderModalParticipants() {
    const list = document.getElementById('modal-participants-list');
    if (!list) return;

    if (currentSessionParticipants.length === 0) {
      list.innerHTML = `<div style="font-size: 12px; color: var(--mute); font-style: italic;">No participants assigned to this session yet.</div>`;
      return;
    }

    list.innerHTML = currentSessionParticipants.map((p, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <strong style="font-size: 13px; color: var(--ink);">${escapeHtml(p.name)}</strong>
          <select onchange="updateParticipantRole(${idx}, this.value)" class="filter-select" style="padding: 4px 8px; font-size: 11px;">
            <option value="Panelist" ${p.role === 'Panelist' ? 'selected' : ''}>Panelist</option>
            <option value="Speaker" ${p.role === 'Speaker' ? 'selected' : ''}>Speaker</option>
            <option value="Guest" ${p.role === 'Guest' ? 'selected' : ''}>Guest</option>
            <option value="Led By" ${p.role === 'Led By' ? 'selected' : ''}>Led By</option>
            <option value="Storytelling" ${p.role === 'Storytelling' ? 'selected' : ''}>Storytelling</option>
            <option value="Programme Leader" ${p.role === 'Programme Leader' ? 'selected' : ''}>Programme Leader</option>
            <option value="Performer" ${p.role === 'Performer' ? 'selected' : ''}>Performer</option>
          </select>
        </div>
        <div style="display: flex; gap: 4px;">
          ${idx > 0 ? `<button type="button" class="btn btn-sm" onclick="moveParticipant(${idx}, -1)" title="Move Up">↑</button>` : ''}
          ${idx < currentSessionParticipants.length - 1 ? `<button type="button" class="btn btn-sm" onclick="moveParticipant(${idx}, 1)" title="Move Down">↓</button>` : ''}
          <button type="button" class="btn btn-sm danger" onclick="removeParticipant(${idx})" title="Remove">×</button>
        </div>
      </div>
    `).join('');
  }

  function updateParticipantRole(idx, newRole) {
    if (currentSessionParticipants[idx]) {
      currentSessionParticipants[idx].role = newRole;
    }
  }
  window.updateParticipantRole = updateParticipantRole;

  function moveParticipant(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= currentSessionParticipants.length) return;
    const temp = currentSessionParticipants[idx];
    currentSessionParticipants[idx] = currentSessionParticipants[target];
    currentSessionParticipants[target] = temp;
    renderModalParticipants();
  }
  window.moveParticipant = moveParticipant;

  function removeParticipant(idx) {
    currentSessionParticipants.splice(idx, 1);
    renderModalParticipants();
  }
  window.removeParticipant = removeParticipant;

  const addPartBtn = document.getElementById('modal-add-part-btn');
  if (addPartBtn) {
    addPartBtn.onclick = () => {
      const nameInput = document.getElementById('modal-new-part-name');
      const roleSelect = document.getElementById('modal-new-part-role');
      const name = nameInput.value.trim();
      const role = roleSelect.value;
      if (!name) return;

      currentSessionParticipants.push({ name, role });
      nameInput.value = '';
      renderModalParticipants();
    };
  }

  // Save session submit handler
  const sessionForm = document.getElementById('session-form');
  if (sessionForm) {
    sessionForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-session-id').value;
      const day_number = parseInt(document.getElementById('edit-session-day').value, 10);
      const date = document.getElementById('edit-session-date').value.trim();
      const session_number = document.getElementById('edit-session-number').value.trim();
      const session_type = document.getElementById('edit-session-type').value;
      const title = document.getElementById('edit-session-title').value.trim();
      const subject = document.getElementById('edit-session-subject').value.trim();
      const start_time = document.getElementById('edit-session-start').value.trim();
      const end_time = document.getElementById('edit-session-end').value.trim();
      const venue = document.getElementById('edit-session-venue').value.trim();
      const category = document.getElementById('edit-session-cat').value.trim();
      const display_order = parseInt(document.getElementById('edit-session-order').value, 10) || 1;
      const description = document.getElementById('edit-session-desc').value.trim();
      const is_published = document.getElementById('edit-session-published').checked;

      const dayObj = allProgrammeDays.find(d => d.day_number === day_number);
      const day_id = dayObj ? dayObj.id : null;
      const speakerSummary = currentSessionParticipants.map(p => p.name).join(', ');

      const payload = {
        day_id,
        day_number,
        date,
        session_number: session_number || null,
        session_type,
        title,
        subject: subject || null,
        start_time,
        end_time: end_time || null,
        venue,
        category,
        display_order,
        sort_order: display_order,
        description: description || null,
        is_published,
        status: 'scheduled',
        participants: currentSessionParticipants,
        speaker: speakerSummary,
        updated_at: new Date().toISOString()
      };

      const sb = window.getSupabase();
      try {
        let savedSessionId = id;
        if (id) {
          const { error } = await sb.from('programme_items').update(payload).eq('id', id);
          if (error) throw error;
          showToast('Session updated successfully!');
        } else {
          const { data: newSession, error } = await sb.from('programme_items').insert(payload).select().single();
          if (error) throw error;
          savedSessionId = newSession.id;
          showToast('New session added to programme!');
        }

        // Sync participants to relational tables
        if (savedSessionId && currentSessionParticipants.length > 0) {
          try {
            for (const p of currentSessionParticipants) {
              await sb.from('programme_people').upsert({ name: p.name }, { onConflict: 'name' });
            }
            const { data: freshPeople } = await sb.from('programme_people').select('*');
            if (freshPeople) allProgrammePeople = freshPeople;

            await sb.from('programme_session_participants').delete().eq('session_id', savedSessionId);
            const partRows = currentSessionParticipants.map((p, idx) => {
              const person = allProgrammePeople.find(x => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
              return {
                session_id: savedSessionId,
                person_id: person ? person.id : null,
                role: p.role || 'Participant',
                display_order: idx + 1
              };
            }).filter(row => row.person_id !== null);

            if (partRows.length > 0) {
              await sb.from('programme_session_participants').insert(partRows);
            }
          } catch (syncErr) {
            console.warn('Participant relational sync warning:', syncErr);
          }
        } else if (savedSessionId) {
          await sb.from('programme_session_participants').delete().eq('session_id', savedSessionId);
        }

        document.getElementById('session-modal').close();
        await loadProgramme();
      } catch (err) {
        alert('Session save error: ' + err.message);
      }
    };
  }

  async function deleteSession(id) {
    if (!confirm('Are you sure you want to delete this programme session?')) return;
    const sb = window.getSupabase();
    try {
      const { error } = await sb.from('programme_items').delete().eq('id', id);
      if (error) throw error;
      showToast('Session deleted.');
      await loadProgramme();
    } catch (err) {
      alert('Delete error: ' + err.message);
    }
  }
  window.deleteSession = deleteSession;

  // -------------------------------------------------------------
  // SETTINGS & ADMIN TEAM
  // -------------------------------------------------------------
  async function loadSettings() {
    const sb = window.getSupabase();
    try {
      const { data } = await sb.from('festival_settings').select('*').eq('id', 'general').single();
      if (data) {
        if (document.getElementById('set-total-seats')) {
          document.getElementById('set-total-seats').value = data.total_programme_seats !== undefined && data.total_programme_seats !== null ? data.total_programme_seats : 30;
        }
        if (document.getElementById('set-baseline-seats')) {
          document.getElementById('set-baseline-seats').value = data.baseline_booked_seats !== undefined && data.baseline_booked_seats !== null ? data.baseline_booked_seats : 10;
        }
        document.getElementById('set-upi-id').value = data.upi_id || '9847411637@kotakbank';
        document.getElementById('set-payee-name').value = data.upi_payee_name || 'SHINAS';
        document.getElementById('set-qr-url').value = data.upi_qr_image_url || 'assets/hlf-upi-qr.png';
        document.getElementById('set-contact-email').value = data.contact_email || 'hadithliteraturefestival@gmail.com';
        document.getElementById('set-contact-phone').value = data.contact_phone || '+91 73065 54055';
        document.getElementById('set-venue').value = data.festival_venue || 'Darul Huda Islamic University, Chemmad, Kerala';
      }

      // Load admin users list
      const { data: admins } = await sb.from('admin_users').select('*').order('created_at', { ascending: true });
      if (admins) {
        document.getElementById('admin-users-list').innerHTML = `
          <strong>Authorized Administrators (${admins.length}):</strong>
          <ul style="padding-left: 20px; margin-top: 8px;">
            ${admins.map(a => `<li><code>${escapeHtml(a.email)}</code> <span class="badge ${a.role === 'super_admin' ? 'primary' : ''}">${a.role}</span></li>`).join('')}
          </ul>
        `;
      }
    } catch (e) {
      console.warn('Load settings error:', e);
    }
  }

  document.getElementById('festival-settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const total_programme_seats = parseInt(document.getElementById('set-total-seats')?.value || '30', 10);
    const baseline_booked_seats = parseInt(document.getElementById('set-baseline-seats')?.value || '10', 10);
    const upi_id = document.getElementById('set-upi-id').value.trim();
    const upi_payee_name = document.getElementById('set-payee-name').value.trim();
    const upi_qr_image_url = document.getElementById('set-qr-url').value.trim();
    const contact_email = document.getElementById('set-contact-email').value.trim();
    const contact_phone = document.getElementById('set-contact-phone').value.trim();
    const festival_venue = document.getElementById('set-venue').value.trim();

    const sb = window.getSupabase();
    try {
      const { error } = await sb.from('festival_settings').upsert({
        id: 'general',
        donation_goal: currentContributionTarget,
        total_programme_seats: isNaN(total_programme_seats) ? 30 : total_programme_seats,
        baseline_booked_seats: isNaN(baseline_booked_seats) ? 10 : baseline_booked_seats,
        upi_id,
        upi_payee_name,
        upi_qr_image_url,
        contact_email,
        contact_phone,
        festival_venue,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      showToast('Festival settings saved successfully!');
      updateSeatAvailabilityCard();
    } catch (err) {
      alert('Error updating settings: ' + err.message);
    }
  };

  document.getElementById('add-admin-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('new-admin-email').value.trim();
    if (!email) return;

    const sb = window.getSupabase();
    try {
      const { data, error } = await sb.rpc('add_admin_user', { p_email: email });
      if (error) throw error;
      showToast(`Admin ${email} authorized successfully!`);
      document.getElementById('new-admin-email').value = '';
      await loadSettings();
    } catch (err) {
      alert('Could not authorize admin: ' + err.message);
    }
  };


  // -------------------------------------------------------------
  // SITE IMAGES & BRANDING MANAGEMENT
  // -------------------------------------------------------------
  function resolveAssetUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('/')) {
      return url;
    }
    const isSubdir = window.location.pathname.includes('/admin') || window.location.pathname.endsWith('/admin/');
    if (isSubdir && !url.startsWith('../')) {
      return '../' + url;
    }
    return url;
  }

  async function loadSiteBranding() {
    const defaultImages = {
      logo: resolveAssetUrl('assets/images/logo/hlf-logo.png'),
      favicon: resolveAssetUrl('assets/images/logo/favicon.png'),
      officialPoster: resolveAssetUrl('assets/images/posters/hlf-2026-official-poster.png'),
      featuredImage: resolveAssetUrl('assets/images/posters/hlf-2026-official-poster.png')
    };

    const logoImg = document.getElementById('brand-logo-preview');
    const faviconImg = document.getElementById('brand-favicon-preview');
    const posterImg = document.getElementById('brand-poster-preview');
    const heroImg = document.getElementById('brand-hero-preview');

    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) {
      if (logoImg && !logoImg.src) { logoImg.src = defaultImages.logo; logoImg.dataset.savedSrc = defaultImages.logo; }
      if (faviconImg && !faviconImg.src) { faviconImg.src = defaultImages.favicon; faviconImg.dataset.savedSrc = defaultImages.favicon; }
      if (posterImg && !posterImg.src) { posterImg.src = defaultImages.officialPoster; posterImg.dataset.savedSrc = defaultImages.officialPoster; }
      if (heroImg && !heroImg.src) { heroImg.src = defaultImages.featuredImage; heroImg.dataset.savedSrc = defaultImages.featuredImage; }
      return;
    }

    try {
      // 1. Fetch persistent site branding from festival_settings
      const { data: sData, error: sErr } = await sb
        .from('festival_settings')
        .select('logo_url, favicon_url, official_poster_url')
        .eq('id', 'general')
        .maybeSingle();

      const activeLogo = (sData && sData.logo_url && sData.logo_url.trim()) ? sData.logo_url.trim() : defaultImages.logo;
      const activeFavicon = (sData && sData.favicon_url && sData.favicon_url.trim()) ? sData.favicon_url.trim() : defaultImages.favicon;
      let activePoster = (sData && sData.official_poster_url && sData.official_poster_url.trim()) ? sData.official_poster_url.trim() : null;

      // 2. Fallback to active poster in posters table if not configured in festival_settings
      if (!activePoster) {
        const { data: pData } = await sb
          .from('posters')
          .select('image_url')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pData?.image_url && pData.image_url.trim()) {
          activePoster = pData.image_url.trim();
        } else {
          activePoster = defaultImages.officialPoster;
        }
      }

      // 3. Featured hero image from gallery_items
      let activeHero = activePoster;
      const { data: gData } = await sb
        .from('gallery_items')
        .select('image_url')
        .eq('featured', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gData?.image_url && gData.image_url.trim()) {
        activeHero = gData.image_url.trim();
      }

      // Apply to preview elements and cache the confirmed saved source
      if (logoImg) {
        logoImg.src = activeLogo;
        logoImg.dataset.savedSrc = activeLogo;
      }
      if (faviconImg) {
        faviconImg.src = activeFavicon;
        faviconImg.dataset.savedSrc = activeFavicon;
        document.querySelectorAll("link[rel*='icon']").forEach(l => l.href = activeFavicon);
      }
      if (posterImg) {
        posterImg.src = activePoster;
        posterImg.dataset.savedSrc = activePoster;
      }
      if (heroImg) {
        heroImg.src = activeHero;
        heroImg.dataset.savedSrc = activeHero;
      }
    } catch (e) {
      console.warn('Could not load remote branding images:', e);
      if (logoImg && !logoImg.src) { logoImg.src = defaultImages.logo; logoImg.dataset.savedSrc = defaultImages.logo; }
      if (faviconImg && !faviconImg.src) { faviconImg.src = defaultImages.favicon; faviconImg.dataset.savedSrc = defaultImages.favicon; }
      if (posterImg && !posterImg.src) { posterImg.src = defaultImages.officialPoster; posterImg.dataset.savedSrc = defaultImages.officialPoster; }
      if (heroImg && !heroImg.src) { heroImg.src = defaultImages.featuredImage; heroImg.dataset.savedSrc = defaultImages.featuredImage; }
    }
  }
  window.loadSiteBranding = loadSiteBranding;

  function setupBrandingHandlers() {
    const bindUpload = (fileInputId, previewImgId, uploadBtnId, onUploadFn, validationOptions = {}) => {
      const fileInput = document.getElementById(fileInputId);
      const previewImg = document.getElementById(previewImgId);
      const uploadBtn = document.getElementById(uploadBtnId);

      if (!fileInput || !previewImg || !uploadBtn) return;

      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];

          // Validate file size limit
          const maxBytes = (validationOptions.maxMB || 10) * 1024 * 1024;
          if (file.size > maxBytes) {
            alert(`File size exceeds ${validationOptions.maxMB || 10}MB limit. Please select a smaller file.`);
            fileInput.value = '';
            return;
          }

          // Validate file extension/type
          if (Array.isArray(validationOptions.allowedExtensions) && validationOptions.allowedExtensions.length > 0) {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            if (!validationOptions.allowedExtensions.includes(ext)) {
              alert(`Invalid file format .${ext}. Allowed formats: ${validationOptions.allowedExtensions.join(', ')}`);
              fileInput.value = '';
              return;
            }
          }

          // Remember previous saved source before showing temporary preview
          if (!previewImg.dataset.savedSrc && previewImg.src) {
            previewImg.dataset.savedSrc = previewImg.src;
          }

          const reader = new FileReader();
          reader.onload = (ev) => {
            previewImg.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      };

      uploadBtn.onclick = async () => {
        if (!fileInput.files || !fileInput.files[0]) {
          alert('Please select an image file first.');
          return;
        }
        uploadBtn.disabled = true;
        const origText = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<span>Uploading...</span>';
        try {
          await onUploadFn(fileInput.files[0]);
          fileInput.value = '';
        } catch (err) {
          console.error('Branding upload failed:', err);
          alert('Upload failed: ' + (err.message || err));
          // Restore previously confirmed saved image
          if (previewImg.dataset.savedSrc) {
            previewImg.src = previewImg.dataset.savedSrc;
          }
          fileInput.value = '';
        } finally {
          uploadBtn.disabled = false;
          uploadBtn.innerHTML = origText;
        }
      };
    };

    // 1. Logo Replacement (PNG, JPG, WebP, SVG — max 10MB)
    bindUpload('brand-logo-file', 'brand-logo-preview', 'save-logo-btn', async (file) => {
      const sb = window.getSupabase();
      if (!sb) throw new Error('Supabase client not initialized');

      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = 'branding/hlf-logo_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('hlf-posters').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/png'
      });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = sb.storage.from('hlf-posters').getPublicUrl(path);
      if (!publicUrl) throw new Error('Could not resolve public storage URL for uploaded logo.');

      // Persist in festival_settings via RPC or direct update
      let saved = false;
      try {
        const { error: rpcErr } = await sb.rpc('update_site_branding', {
          p_logo_url: publicUrl,
          p_logo_path: path
        });
        if (!rpcErr) saved = true;
      } catch (_) { }

      if (!saved) {
        const { error: dbErr } = await sb.from('festival_settings').update({
          logo_url: publicUrl,
          logo_path: path,
          updated_at: new Date().toISOString()
        }).eq('id', 'general');
        if (dbErr) throw dbErr;
      }

      showToast('HLF Logo uploaded & persisted successfully!');
      await loadSiteBranding();
    }, { maxMB: 10, allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] });

    // 2. Favicon Replacement (PNG, ICO, SVG, WebP — max 5MB)
    bindUpload('brand-favicon-file', 'brand-favicon-preview', 'save-favicon-btn', async (file) => {
      const sb = window.getSupabase();
      if (!sb) throw new Error('Supabase client not initialized');

      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = 'branding/favicon_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('hlf-posters').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/png'
      });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = sb.storage.from('hlf-posters').getPublicUrl(path);
      if (!publicUrl) throw new Error('Could not resolve public storage URL for uploaded favicon.');

      // Persist in festival_settings via RPC or direct update
      let saved = false;
      try {
        const { error: rpcErr } = await sb.rpc('update_site_branding', {
          p_favicon_url: publicUrl,
          p_favicon_path: path
        });
        if (!rpcErr) saved = true;
      } catch (_) { }

      if (!saved) {
        const { error: dbErr } = await sb.from('festival_settings').update({
          favicon_url: publicUrl,
          favicon_path: path,
          updated_at: new Date().toISOString()
        }).eq('id', 'general');
        if (dbErr) throw dbErr;
      }

      showToast('Browser Favicon uploaded & persisted successfully!');
      await loadSiteBranding();
    }, { maxMB: 5, allowedExtensions: ['png', 'ico', 'svg', 'webp', 'jpg', 'jpeg'] });

    // 3. Official Poster Replacement (JPG, PNG, WebP — max 10MB)
    bindUpload('brand-poster-file', 'brand-poster-preview', 'save-poster-btn', async (file) => {
      const sb = window.getSupabase();
      if (!sb) throw new Error('Supabase client not initialized');

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = 'posters/official-poster_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('hlf-posters').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg'
      });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = sb.storage.from('hlf-posters').getPublicUrl(path);
      if (!publicUrl) throw new Error('Could not resolve public storage URL for uploaded poster.');

      // Persist in festival_settings and posters table
      let saved = false;
      try {
        const { error: rpcErr } = await sb.rpc('update_site_branding', {
          p_official_poster_url: publicUrl,
          p_official_poster_path: path
        });
        if (!rpcErr) saved = true;
      } catch (_) { }

      if (!saved) {
        await sb.from('festival_settings').update({
          official_poster_url: publicUrl,
          official_poster_path: path,
          updated_at: new Date().toISOString()
        }).eq('id', 'general');

        await sb.from('posters').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
        const { error: insErr } = await sb.from('posters').insert({
          title: 'Official HLF 2026 Poster',
          description: 'Primary festival promotional poster',
          image_url: publicUrl,
          storage_path: path,
          is_active: true
        });
        if (insErr) throw insErr;
      }

      showToast('Official Poster uploaded & set as active festival poster!');
      await loadSiteBranding();
      if (typeof loadPosters === 'function') await loadPosters();
    }, { maxMB: 10, allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'] });

    // 4. Featured Hero Visual Replacement
    bindUpload('brand-hero-file', 'brand-hero-preview', 'save-hero-btn', async (file) => {
      const sb = window.getSupabase();
      if (!sb) throw new Error('Supabase client not initialized');

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = 'gallery/featured-hero_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('hlf-gallery').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg'
      });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = sb.storage.from('hlf-gallery').getPublicUrl(path);
      if (!publicUrl) throw new Error('Could not resolve public storage URL for featured visual.');

      // Unset previous featured images in gallery and insert new featured image
      await sb.from('gallery_items').update({ featured: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      const { error: insErr } = await sb.from('gallery_items').insert({
        title: 'HLF Landing Featured Visual',
        description: 'Homepage featured visual showcase',
        image_url: publicUrl,
        storage_path: path,
        category: 'Events',
        published: true,
        featured: true,
        display_order: 1
      });
      if (insErr) throw insErr;

      showToast('Landing Page Featured Visual updated successfully!');
      await loadSiteBranding();
      if (typeof loadGallery === 'function') await loadGallery();
    }, { maxMB: 10, allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'] });
  }

  // Setup branding handlers on init
  setupBrandingHandlers();

  // Toast Helper
  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
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
})();
