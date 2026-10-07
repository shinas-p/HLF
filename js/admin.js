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

  document.addEventListener('DOMContentLoaded', initAdmin);

  async function initAdmin() {
    setupTheme();
    setupNavigation();
    setupAuthListeners();
    checkInitialAdminStatus();
  }

  // 1. Theme Setup
  function setupTheme() {
    try {
      const saved = localStorage.getItem('hlf-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = saved;
    } catch (e) {}

    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('hlf-theme', next); } catch (e) {}
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
      // Check if user ID is in admin_users table
      const { data, error } = await sb.from('admin_users').select('*').eq('id', user.id).single();

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
      const dateStr = new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      return `
        <tr>
          <td><strong>${r.registration_id}</strong></td>
          <td>${escapeHtml(r.full_name)}</td>
          <td>${escapeHtml(r.institution)}</td>
          <td>${r.payment_screenshot_path ? `<span class="badge" style="background: rgba(18,144,122,0.15); color: var(--teal); font-size: 11px;">📸 Proof</span>` : `<code>${escapeHtml(r.transaction_id || '—')}</code>`}</td>
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
          (r.payment_screenshot_path && r.payment_screenshot_path.toLowerCase().includes(searchTerm));
        if (!matches) return false;
      }

      // Payment filter
      if (payFilter !== 'all') {
        if ((r.payment_status || 'pending').toLowerCase() !== payFilter) return false;
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
      const dateStr = new Date(r.created_at).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      return `
        <tr>
          <td><strong>${r.registration_id}</strong></td>
          <td>${escapeHtml(r.full_name)}</td>
          <td>${escapeHtml(r.mobile)}</td>
          <td>${escapeHtml(r.institution)}</td>
          <td>${r.payment_screenshot_path ? `<button type="button" class="btn btn-sm" style="font-size: 11px; padding: 3px 8px; border-color: var(--teal); color: var(--teal);" onclick="openRegistrationDetails('${r.id}')">📸 Screenshot</button>` : `<code>${escapeHtml(r.transaction_id || '—')}</code>`}</td>
          <td><span class="badge ${pStatus}">${pStatus}</span></td>
          <td><span class="badge ${rStatus}">${rStatus}</span></td>
          <td style="font-size: 11px; color: var(--mute);">${dateStr}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn btn-sm" title="View Profile" onclick="openRegistrationDetails('${r.id}')">👁️</button>
              ${pStatus !== 'verified' ? `<button type="button" class="btn btn-sm secondary" title="Verify Payment" onclick="confirmVerifyPayment('${r.id}')">✓</button>` : ''}
              ${pStatus !== 'rejected' ? `<button type="button" class="btn btn-sm danger" title="Reject Payment" onclick="confirmRejectPayment('${r.id}')">✕</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Setup Registrations Search and Filter Listeners
  document.getElementById('reg-search-input').oninput = renderRegistrationsTable;
  document.getElementById('reg-payment-filter').onchange = renderRegistrationsTable;
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
      'Payment Screenshot Path',
      'Legacy Transaction ID',
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
      r.payment_screenshot_path || '',
      r.transaction_id || '',
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
    `;

    document.getElementById('modal-btn-verify').onclick = () => confirmVerifyPayment(reg.id);
    document.getElementById('modal-btn-reject').onclick = () => confirmRejectPayment(reg.id);
    document.getElementById('modal-btn-delete').onclick = () => confirmDeleteRegistration(reg.id);

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
          } catch (e) {}
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
  // PROGRAMME / SCHEDULE MANAGEMENT
  // -------------------------------------------------------------
  async function loadProgramme() {
    const sb = window.getSupabase();
    try {
      const { data, error } = await sb.from('programme_items')
        .select('*')
        .order('day_number', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      allProgramme = data || [];
      renderProgrammeTable();
    } catch (err) {
      console.warn('Load programme error:', err);
    }
  }

  function renderProgrammeTable() {
    const tbody = document.getElementById('programme-tbody');
    const dayFilter = document.getElementById('prog-day-filter').value;

    const filtered = allProgramme.filter(p => {
      if (dayFilter !== 'all' && String(p.day_number) !== dayFilter) return false;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--mute);">No sessions found for this day.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => `
      <tr>
        <td><strong>Day ${p.day_number}</strong></td>
        <td><code>${escapeHtml(p.start_time || '')} ${p.end_time ? '– ' + escapeHtml(p.end_time) : ''}</code></td>
        <td><strong>${escapeHtml(p.title)}</strong><br><small style="color: var(--mute);">${escapeHtml(p.description || '')}</small></td>
        <td>${escapeHtml(p.speaker || '—')}</td>
        <td>${escapeHtml(p.venue || '—')}</td>
        <td><span class="badge">${escapeHtml(p.category || 'General')}</span></td>
        <td>
          <button class="btn btn-sm" onclick="editSession('${p.id}')">✏️</button>
          <button class="btn btn-sm danger" onclick="deleteSession('${p.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('prog-day-filter').onchange = renderProgrammeTable;

  document.getElementById('open-new-session-btn').onclick = () => {
    document.getElementById('session-modal-title').textContent = 'Add Programme Session';
    document.getElementById('edit-session-id').value = '';
    document.getElementById('edit-session-day').value = '1';
    document.getElementById('edit-session-date').value = '2026-10-18';
    document.getElementById('edit-session-start').value = '';
    document.getElementById('edit-session-end').value = '';
    document.getElementById('edit-session-title').value = '';
    document.getElementById('edit-session-speaker').value = '';
    document.getElementById('edit-session-venue').value = 'Imam Al-Bukhari Auditorium';
    document.getElementById('edit-session-cat').value = 'Ceremony';
    document.getElementById('edit-session-desc').value = '';
    document.getElementById('session-modal').showModal();
  };

  function editSession(id) {
    const s = allProgramme.find(x => x.id === id);
    if (!s) return;
    document.getElementById('session-modal-title').textContent = 'Edit Programme Session';
    document.getElementById('edit-session-id').value = s.id;
    document.getElementById('edit-session-day').value = s.day_number || 1;
    document.getElementById('edit-session-date').value = s.date || '2026-10-18';
    document.getElementById('edit-session-start').value = s.start_time || '';
    document.getElementById('edit-session-end').value = s.end_time || '';
    document.getElementById('edit-session-title').value = s.title || '';
    document.getElementById('edit-session-speaker').value = s.speaker || '';
    document.getElementById('edit-session-venue').value = s.venue || '';
    document.getElementById('edit-session-cat').value = s.category || '';
    document.getElementById('edit-session-desc').value = s.description || '';
    document.getElementById('session-modal').showModal();
  }
  window.editSession = editSession;

  document.getElementById('session-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-session-id').value;
    const day_number = parseInt(document.getElementById('edit-session-day').value, 10);
    const date = document.getElementById('edit-session-date').value.trim();
    const start_time = document.getElementById('edit-session-start').value.trim();
    const end_time = document.getElementById('edit-session-end').value.trim();
    const title = document.getElementById('edit-session-title').value.trim();
    const speaker = document.getElementById('edit-session-speaker').value.trim();
    const venue = document.getElementById('edit-session-venue').value.trim();
    const category = document.getElementById('edit-session-cat').value.trim();
    const description = document.getElementById('edit-session-desc').value.trim();

    const sb = window.getSupabase();
    try {
      if (id) {
        await sb.from('programme_items').update({
          day_number, date, start_time, end_time, title, speaker, venue, category, description
        }).eq('id', id);
        showToast('Session updated!');
      } else {
        await sb.from('programme_items').insert({
          day_number, date, start_time, end_time, title, speaker, venue, category, description,
          sort_order: allProgramme.length + 1, status: 'scheduled'
        });
        showToast('New session added to schedule!');
      }
      document.getElementById('session-modal').close();
      await loadProgramme();
    } catch (err) {
      alert('Session save error: ' + err.message);
    }
  };

  async function deleteSession(id) {
    if (!confirm('Are you sure you want to delete this programme session?')) return;
    const sb = window.getSupabase();
    try {
      await sb.from('programme_items').delete().eq('id', id);
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
        document.getElementById('set-upi-id').value = data.upi_id || 'hlf2026@dhiu';
        document.getElementById('set-payee-name').value = data.upi_payee_name || 'Hadith Literature Festival DHIU';
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

    // Update previews with defaults first
    const logoImg = document.getElementById('brand-logo-preview');
    const faviconImg = document.getElementById('brand-favicon-preview');
    const posterImg = document.getElementById('brand-poster-preview');
    const heroImg = document.getElementById('brand-hero-preview');

    if (logoImg) logoImg.src = defaultImages.logo;
    if (faviconImg) faviconImg.src = defaultImages.favicon;
    if (posterImg) posterImg.src = defaultImages.officialPoster;
    if (heroImg) heroImg.src = defaultImages.featuredImage;

    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) return;

    try {
      // 1. Active poster from Supabase
      const { data: pData } = await sb
        .from('posters')
        .select('image_url')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pData?.image_url && posterImg) {
        posterImg.src = pData.image_url;
      }

      // 2. Featured hero image from gallery_items
      const { data: gData } = await sb
        .from('gallery_items')
        .select('image_url')
        .eq('featured', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gData?.image_url && heroImg) {
        heroImg.src = gData.image_url;
      } else if (pData?.image_url && heroImg) {
        heroImg.src = pData.image_url;
      }
    } catch (e) {
      console.warn('Could not load remote branding images:', e);
    }
  }
  window.loadSiteBranding = loadSiteBranding;

  function setupBrandingHandlers() {
    const bindUpload = (fileInputId, previewImgId, uploadBtnId, onUploadFn) => {
      const fileInput = document.getElementById(fileInputId);
      const previewImg = document.getElementById(previewImgId);
      const uploadBtn = document.getElementById(uploadBtnId);

      if (!fileInput || !previewImg || !uploadBtn) return;

      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
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
          alert('Upload failed: ' + err.message);
        } finally {
          uploadBtn.disabled = false;
          uploadBtn.innerHTML = origText;
        }
      };
    };

    // 1. Logo Replacement
    bindUpload('brand-logo-file', 'brand-logo-preview', 'save-logo-btn', async (file) => {
      const sb = window.getSupabase();
      const ext = file.name.split('.').pop() || 'png';
      const path = 'branding/hlf-logo_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('hlf-posters').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = sb.storage.from('hlf-posters').getPublicUrl(path);
      showToast('HLF Logo updated successfully!');
      await loadSiteBranding();
    });

    // 2. Favicon Replacement
    bindUpload('brand-favicon-file', 'brand-favicon-preview', 'save-favicon-btn', async (file) => {
      const sb = window.getSupabase();
      const ext = file.name.split('.').pop() || 'png';
      const path = 'branding/favicon_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('hlf-posters').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = sb.storage.from('hlf-posters').getPublicUrl(path);
      showToast('Favicon updated successfully!');
      await loadSiteBranding();
    });

    // 3. Official Poster Replacement
    bindUpload('brand-poster-file', 'brand-poster-preview', 'save-poster-btn', async (file) => {
      const sb = window.getSupabase();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = 'posters/official-poster_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('hlf-posters').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = sb.storage.from('hlf-posters').getPublicUrl(path);

      // Set all other posters inactive and insert new active poster
      await sb.from('posters').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      await sb.from('posters').insert({
        title: 'Official HLF 2026 Poster',
        description: 'Primary festival promotional poster',
        image_url: publicUrl,
        storage_path: path,
        is_active: true
      });

      showToast('Official Poster uploaded & set as active festival poster!');
      await loadSiteBranding();
      if (typeof loadPosters === 'function') await loadPosters();
    });

    // 4. Featured Hero Visual Replacement
    bindUpload('brand-hero-file', 'brand-hero-preview', 'save-hero-btn', async (file) => {
      const sb = window.getSupabase();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = 'gallery/featured-hero_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('hlf-gallery').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = sb.storage.from('hlf-gallery').getPublicUrl(path);

      // Unset previous featured images in gallery and insert new featured image
      await sb.from('gallery_items').update({ featured: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      await sb.from('gallery_items').insert({
        title: 'HLF Landing Featured Visual',
        description: 'Homepage featured visual showcase',
        image_url: publicUrl,
        storage_path: path,
        category: 'Events',
        published: true,
        featured: true,
        display_order: 1
      });

      showToast('Landing Page Featured Visual updated successfully!');
      await loadSiteBranding();
      if (typeof loadGallery === 'function') await loadGallery();
    });
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
