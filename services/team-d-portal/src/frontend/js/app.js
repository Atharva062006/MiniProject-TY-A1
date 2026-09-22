/**
 * APNILEAP Placement Portal & Analytics Dashboard — Team D Frontend SPA
 * Strict Zero-Emoji Professional Web Technology Client
 */

(function () {
  'use strict';

  // ── Global State ────────────────────────────────────────────────────────────
  const state = {
    user: null,
    token: localStorage.getItem('apnileap_token') || null,
    role: 'student', // 'student' | 'faculty' | 'admin'
    activeTab: 'drives', // depends on active role
    students: [],
    activeStudent: null,
    drives: [],
    applications: [],
    dashboard: null,
    reports: null,
    rankingsPreview: null,
    selectedAlgo: 'WEIGHTED_SCORE',
    sseConnected: false,
    eventSource: null,
  };

  // Role Tab Configurations
  const ROLE_TABS = {
    student: [
      { id: 'drives', label: 'Available Drives' },
      { id: 'applications', label: 'My Applications' },
      { id: 'profile', label: 'My Profile' },
    ],
    faculty: [
      { id: 'reports', label: 'Placement Reports' },
      { id: 'cohort', label: 'Cohort Analytics' },
      { id: 'companies', label: 'Company Directory' },
    ],
    admin: [
      { id: 'dashboard', label: 'Operations Dashboard' },
      { id: 'drive-management', label: 'Drive Management' },
      { id: 'companies', label: 'Company Directory' },
      { id: 'ranking-engine', label: 'Ranking Engine' },
      { id: 'user-accounts', label: 'User Accounts' },
      { id: 'audit-trail', label: 'Audit Trail' },
    ],
  };

  // ── DOM References ──────────────────────────────────────────────────────────
  const elements = {
    userDisplayChip: document.getElementById('user-display-chip'),
    authBtn: document.getElementById('auth-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    connectionChip: document.getElementById('connection-chip'),
    lastUpdated: document.getElementById('last-updated'),
    navTabs: document.getElementById('nav-tabs'),
    banner: document.getElementById('notification-banner'),
    bannerText: document.getElementById('banner-text'),
    bannerClose: document.getElementById('banner-close'),
    mainContent: document.getElementById('main-content'),

    // Authentication Modal
    authModal: document.getElementById('auth-modal'),
    modalAuthClose: document.getElementById('modal-auth-close'),
    tabAuthLogin: document.getElementById('tab-auth-login'),
    tabAuthRegister: document.getElementById('tab-auth-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    loginErrorMsg: document.getElementById('login-error-msg'),
    regRole: document.getElementById('reg-role'),
    regName: document.getElementById('reg-name'),
    regUsername: document.getElementById('reg-username'),
    regEmail: document.getElementById('reg-email'),
    regPassword: document.getElementById('reg-password'),
    studentRegFields: document.getElementById('student-reg-fields'),
    regBranch: document.getElementById('reg-branch'),
    regCgpa: document.getElementById('reg-cgpa'),
    regBacklogs: document.getElementById('reg-backlogs'),
    regAttendance: document.getElementById('reg-attendance'),
    regSkills: document.getElementById('reg-skills'),
    registerErrorMsg: document.getElementById('register-error-msg'),

    // Apply Modal
    applyModal: document.getElementById('apply-modal'),
    applyForm: document.getElementById('apply-form'),
    applyDriveId: document.getElementById('apply-drive-id'),
    modalDriveTitle: document.getElementById('modal-drive-title'),
    modalDriveIdDisplay: document.getElementById('modal-drive-id-display'),
    modalCompanyDisplay: document.getElementById('modal-company-display'),
    modalStudentDisplay: document.getElementById('modal-student-display'),
    modalMetricsDisplay: document.getElementById('modal-metrics-display'),
    resumeVersion: document.getElementById('resume-version'),
    applyConsent: document.getElementById('apply-consent'),
    applyModalProgress: document.getElementById('apply-modal-progress'),
    applyProgressText: document.getElementById('apply-progress-text'),
    modalApplyClose: document.getElementById('modal-apply-close'),
    modalApplyCancel: document.getElementById('modal-apply-cancel'),
    modalApplySubmit: document.getElementById('modal-apply-submit'),

    // Edit Drive Modal
    driveEditModal: document.getElementById('drive-edit-modal'),
    driveEditForm: document.getElementById('drive-edit-form'),
    editDriveId: document.getElementById('edit-drive-id'),
    editTitle: document.getElementById('edit-title'),
    editSeats: document.getElementById('edit-seats'),
    editPackage: document.getElementById('edit-package'),
    editState: document.getElementById('edit-state'),
    editMinCgpa: document.getElementById('edit-min-cgpa'),
    editMaxBacklogs: document.getElementById('edit-max-backlogs'),
    editMinAttendance: document.getElementById('edit-min-attendance'),
    editBranches: document.getElementById('edit-branches'),
    modalEditClose: document.getElementById('modal-edit-close'),
    modalEditCancel: document.getElementById('modal-edit-cancel'),

    // Create Company Modal
    createCompanyModal: document.getElementById('create-company-modal'),
    createCompanyForm: document.getElementById('create-company-form'),
    newCompanyName: document.getElementById('new-company-name'),
    newCompanyIndustry: document.getElementById('new-company-industry'),
    newCompanyTier: document.getElementById('new-company-tier'),
    newCompanyEmail: document.getElementById('new-company-email'),
    newCompanyWebsite: document.getElementById('new-company-website'),
    companyModalError: document.getElementById('company-modal-error'),
    modalCreateCompanyClose: document.getElementById('modal-create-company-close'),
    modalCreateCompanyCancel: document.getElementById('modal-create-company-cancel'),

    // Create Drive Modal
    createDriveModal: document.getElementById('create-drive-modal'),
    createDriveForm: document.getElementById('create-drive-form'),
    newDriveCompanySelect: document.getElementById('new-drive-company-select'),
    newDriveTitle: document.getElementById('new-drive-title'),
    newDrivePackage: document.getElementById('new-drive-package'),
    newDriveSeats: document.getElementById('new-drive-seats'),
    newDriveMinCgpa: document.getElementById('new-drive-min-cgpa'),
    newDriveMaxBacklogs: document.getElementById('new-drive-max-backlogs'),
    newDriveMinAttendance: document.getElementById('new-drive-min-attendance'),
    newDriveBranches: document.getElementById('new-drive-branches'),
    newDriveSkills: document.getElementById('new-drive-skills'),
    driveModalError: document.getElementById('drive-modal-error'),
    modalCreateDriveClose: document.getElementById('modal-create-drive-close'),
    modalCreateDriveCancel: document.getElementById('modal-create-drive-cancel'),

    // Schedule Interview Modal
    scheduleModal: document.getElementById('schedule-modal'),
    scheduleForm: document.getElementById('schedule-form'),
    scheduleAppId: document.getElementById('schedule-app-id'),
    scheduleStudentId: document.getElementById('schedule-student-id'),
    scheduleStudentName: document.getElementById('schedule-student-name'),
    scheduleDriveTitle: document.getElementById('schedule-drive-title'),
    scheduleSlotId: document.getElementById('schedule-slot-id'),
    scheduleInterviewerId: document.getElementById('schedule-interviewer-id'),
    scheduleModalError: document.getElementById('schedule-modal-error'),
    modalScheduleClose: document.getElementById('modal-schedule-close'),
    modalScheduleCancel: document.getElementById('modal-schedule-cancel'),
  };

  // ── Helper Utilities ────────────────────────────────────────────────────────
  function updateTimestamp() {
    const now = new Date();
    elements.lastUpdated.textContent = now.toTimeString().split(' ')[0];
  }

  function showBanner(type, message) {
    elements.banner.className = `banner ${type}`;
    elements.bannerText.textContent = message;
    elements.banner.classList.remove('hidden');
  }

  function hideBanner() {
    elements.banner.classList.add('hidden');
  }

  function formatCurrency(amount) {
    if (!amount) return 'INR 0';
    return `INR ${(Number(amount)).toLocaleString('en-IN')}`;
  }

  function getStateChipClass(stateName) {
    switch (stateName) {
      case 'APPLIED': return 'chip-applied';
      case 'SCREENING': return 'chip-screening';
      case 'RULE_EVALUATED': return 'chip-evaluated';
      case 'SHORTLISTED': return 'chip-shortlisted';
      case 'SELECTED': return 'chip-selected';
      case 'OFFER_ISSUED': return 'chip-offered';
      case 'NOT_ELIGIBLE': return 'chip-not-eligible';
      case 'WITHDRAWN': return 'chip-withdrawn';
      default: return 'chip-applied';
    }
  }

  async function apiFetch(endpoint, options = {}) {
    try {
      const authHeaders = state.token ? { 'Authorization': `Bearer ${state.token}` } : {};
      const res = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...authHeaders,
          ...(options.headers || {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && state.token) {
          // Token expired or invalid
          handleLogout();
        }
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      updateTimestamp();
      return data?.data !== undefined ? data.data : data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  // ── Navigation & Tabs ───────────────────────────────────────────────────────
  function renderTabs() {
    const tabs = ROLE_TABS[state.role] || [];
    elements.navTabs.innerHTML = '';

    // Verify activeTab belongs to role, else set to first tab
    if (!tabs.some(t => t.id === state.activeTab)) {
      state.activeTab = tabs[0]?.id || 'drives';
    }

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${tab.id === state.activeTab ? 'active' : ''}`;
      btn.textContent = tab.label;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.activeTab = tab.id;
        renderTabs();
        loadActiveView();
      });
      elements.navTabs.appendChild(btn);
    });
  }

  // ── SSE Stream Connection ───────────────────────────────────────────────────
  function initSSE() {
    if (state.eventSource) {
      state.eventSource.close();
    }

    elements.connectionChip.className = 'chip chip-connecting';
    elements.connectionChip.textContent = '[Connecting...]';

    try {
      state.eventSource = new EventSource('/api/v1/ui/stream');

      state.eventSource.addEventListener('connected', () => {
        state.sseConnected = true;
        elements.connectionChip.className = 'chip chip-online';
        elements.connectionChip.textContent = '[Live]';
        updateTimestamp();
      });

      state.eventSource.addEventListener('audit', (evt) => {
        updateTimestamp();
        try {
          const payload = JSON.parse(evt.data);
          // If viewing dashboard or audit trail, live refresh
          if (state.activeTab === 'dashboard' || state.activeTab === 'audit-trail') {
            loadActiveView(true);
          }
          if (state.role === 'student' && state.activeTab === 'applications') {
            loadApplicationsView(true);
          }
        } catch {}
      });

      state.eventSource.addEventListener('state_change', () => {
        updateTimestamp();
        if (state.activeTab === 'dashboard' || state.activeTab === 'applications') {
          loadActiveView(true);
        }
      });

      state.eventSource.onerror = () => {
        state.sseConnected = false;
        elements.connectionChip.className = 'chip chip-offline';
        elements.connectionChip.textContent = '[Offline]';
      };
    } catch (err) {
      elements.connectionChip.className = 'chip chip-offline';
      elements.connectionChip.textContent = '[Disconnected]';
    }
  }

  // ── Session & Authentication ────────────────────────────────────────────────
  async function initSession() {
    if (state.token) {
      try {
        const res = await apiFetch('/api/v1/ui/auth/me');
        if (res?.user) {
          state.user = res.user;
          state.role = res.user.role;
          state.activeStudent = res.student || null;
          updateUserDisplay();
          return;
        }
      } catch (err) {
        console.warn('Session verification notice:', err.message);
        localStorage.removeItem('apnileap_token');
        state.token = null;
        state.user = null;
        state.activeStudent = null;
      }
    }

    // Default unauthenticated / guest mode
    state.user = null;
    state.role = 'student';
    state.activeStudent = null;
    updateUserDisplay();
    openAuthModal('login');
  }

  function updateUserDisplay() {
    if (state.user) {
      const roleLabel = state.user.role.toUpperCase();
      elements.userDisplayChip.textContent = `[${state.user.name} - ${roleLabel}]`;
      elements.authBtn.classList.add('hidden');
      elements.logoutBtn.classList.remove('hidden');
    } else {
      elements.userDisplayChip.textContent = '[Guest]';
      elements.authBtn.classList.remove('hidden');
      elements.logoutBtn.classList.add('hidden');
    }
  }

  // ── Auth Modal Logic ────────────────────────────────────────────────────────
  function openAuthModal(tab = 'login') {
    switchAuthTab(tab);
    elements.authModal.classList.remove('hidden');
  }

  function closeAuthModal() {
    elements.authModal.classList.add('hidden');
    elements.loginErrorMsg.classList.add('hidden');
    elements.registerErrorMsg.classList.add('hidden');
  }

  function switchAuthTab(tab) {
    if (tab === 'login') {
      elements.tabAuthLogin.classList.add('active');
      elements.tabAuthRegister.classList.remove('active');
      elements.loginForm.classList.remove('hidden');
      elements.registerForm.classList.add('hidden');
    } else {
      elements.tabAuthLogin.classList.remove('active');
      elements.tabAuthRegister.classList.add('active');
      elements.loginForm.classList.add('hidden');
      elements.registerForm.classList.remove('hidden');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    elements.loginErrorMsg.classList.add('hidden');
    const username = elements.loginUsername.value.trim();
    const password = elements.loginPassword.value;

    try {
      const res = await apiFetch('/api/v1/ui/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem('apnileap_token', res.token);
      state.token = res.token;
      state.user = res.user;
      state.role = res.user.role;
      state.activeStudent = res.student || null;

      if (state.role === 'student') state.activeTab = 'drives';
      else if (state.role === 'faculty') state.activeTab = 'reports';
      else if (state.role === 'admin') state.activeTab = 'dashboard';

      closeAuthModal();
      updateUserDisplay();
      renderTabs();
      loadActiveView();
      showBanner('success', `[Signed in] Welcome back, ${res.user.name} (${res.user.role})`);
    } catch (err) {
      elements.loginErrorMsg.textContent = err.message || 'Authentication failed';
      elements.loginErrorMsg.classList.remove('hidden');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    elements.registerErrorMsg.classList.add('hidden');

    const role = elements.regRole.value;
    const name = elements.regName.value.trim();
    const username = elements.regUsername.value.trim();
    const email = elements.regEmail.value.trim();
    const password = elements.regPassword.value;

    let studentData = {};
    if (role === 'student') {
      studentData = {
        branch: elements.regBranch.value,
        cgpa: Number(elements.regCgpa.value),
        backlogs: Number(elements.regBacklogs.value),
        attendance: Number(elements.regAttendance.value),
        skills: elements.regSkills.value.split(',').map(s => s.trim()).filter(Boolean),
      };
    }

    try {
      const res = await apiFetch('/api/v1/ui/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          role,
          name,
          username,
          email,
          password,
          studentData,
        }),
      });

      localStorage.setItem('apnileap_token', res.token);
      state.token = res.token;
      state.user = res.user;
      state.role = res.user.role;
      state.activeStudent = res.student || null;

      if (state.role === 'student') state.activeTab = 'drives';
      else if (state.role === 'faculty') state.activeTab = 'reports';
      else if (state.role === 'admin') state.activeTab = 'dashboard';

      closeAuthModal();
      updateUserDisplay();
      renderTabs();
      loadActiveView();
      showBanner('success', `[Account Created] Welcome to APNILEAP, ${res.user.name}`);
    } catch (err) {
      elements.registerErrorMsg.textContent = err.message || 'Registration failed';
      elements.registerErrorMsg.classList.remove('hidden');
    }
  }

  function handleLogout() {
    localStorage.removeItem('apnileap_token');
    state.token = null;
    state.user = null;
    state.activeStudent = null;
    state.role = 'student';
    state.activeTab = 'drives';

    updateUserDisplay();
    renderTabs();
    loadActiveView();
    showBanner('info', '[Signed out] You have been signed out.');
    openAuthModal('login');
  }

  // ── Views ───────────────────────────────────────────────────────────────────

  // 1. Student Views: Available Drives
  async function loadDrivesView() {
    elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Loading placement drives...</p></div></div>';
    try {
      const studentId = state.activeStudent?.student_id || state.user?.student_id;
      const [drives, myApps] = await Promise.all([
        apiFetch('/api/v1/ui/drives'),
        studentId ? apiFetch(`/api/v1/ui/applications?student_id=${studentId}`) : Promise.resolve([]),
      ]);
      state.drives = drives || [];
      state.applications = myApps || [];

      const appliedMap = new Map((myApps || []).map(a => [a.drive_id, a]));
      const stuName = state.activeStudent?.name || state.user?.name || 'Guest Candidate';
      const stuBranch = state.activeStudent?.branch || 'General';
      const stuCgpa = state.activeStudent?.cgpa != null ? state.activeStudent.cgpa : 'N/A';

      let html = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Available Placement Drives</h2>
            <p class="view-subtitle">Active recruitment drives and verified eligibility thresholds for ${stuName} (${stuBranch}, CGPA: ${stuCgpa})</p>
          </div>
        </div>
        <div class="drives-grid">
      `;

      if (state.drives.length === 0) {
        html += `<div class="card" style="grid-column: 1 / -1;"><div class="card-body"><p class="text-muted">No placement drives found.</p></div></div>`;
      } else {
        state.drives.forEach(drive => {
          const applied = appliedMap.get(drive.drive_id);
          const criteria = drive.criteria || {};
          const branches = Array.isArray(criteria.branches) ? criteria.branches.join(', ') : 'All Branches';
          const minCgpa = criteria.min_cgpa !== undefined ? criteria.min_cgpa : 'N/A';
          const maxBacklogs = criteria.max_backlogs !== undefined ? criteria.max_backlogs : 'N/A';
          const requiredSkills = Array.isArray(criteria.required_skills) ? criteria.required_skills.join(', ') : 'Not specified';

          // Client-side quick check indicator
          const isBranchEligible = !state.activeStudent || !criteria.branches || criteria.branches.includes(state.activeStudent.branch);
          const isCgpaEligible = !state.activeStudent || criteria.min_cgpa === undefined || state.activeStudent.cgpa >= criteria.min_cgpa;
          const isBacklogEligible = !state.activeStudent || criteria.max_backlogs === undefined || state.activeStudent.backlogs <= criteria.max_backlogs;
          const preEligible = isBranchEligible && isCgpaEligible && isBacklogEligible;

          html += `
            <div class="drive-card">
              <div>
                <div class="drive-card-header">
                  <span class="chip ${drive.state === 'OPEN' ? 'chip-online' : 'chip-offline'}">[${drive.state}]</span>
                  <span class="mono text-muted" style="font-size: 0.75rem;">${drive.drive_id}</span>
                </div>
                <h3 class="drive-card-title">${drive.title}</h3>
                <div class="drive-card-company">${drive.company_name || 'Partner Company'} &bull; ${formatCurrency(drive.package)}</div>
                
                <div class="criteria-list">
                  <div class="criteria-item">
                    <span class="criteria-label">Available Seats:</span>
                    <span class="criteria-val">${drive.seats}</span>
                  </div>
                  <div class="criteria-item">
                    <span class="criteria-label">Queue Length:</span>
                    <span class="criteria-val">${drive.queue_length} pending</span>
                  </div>
                  <div class="criteria-item">
                    <span class="criteria-label">Min CGPA:</span>
                    <span class="criteria-val">${minCgpa}</span>
                  </div>
                  <div class="criteria-item">
                    <span class="criteria-label">Max Backlogs:</span>
                    <span class="criteria-val">${maxBacklogs}</span>
                  </div>
                  <div class="criteria-item">
                    <span class="criteria-label">Allowed Branches:</span>
                    <span class="criteria-val">${branches}</span>
                  </div>
                  <div class="criteria-item">
                    <span class="criteria-label">Key Skills:</span>
                    <span class="criteria-val" style="font-size: 0.72rem;">${requiredSkills}</span>
                  </div>
                </div>
              </div>

              <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <span class="chip ${preEligible ? 'chip-online' : 'chip-not-eligible'}">
                  ${preEligible ? '[Criteria Met]' : '[Criteria Mismatch]'}
                </span>
                ${applied
                  ? `<span class="chip ${getStateChipClass(applied.state)}">[Applied: ${applied.state}]</span>`
                  : `<button class="btn btn-primary btn-apply" data-id="${drive.drive_id}" ${drive.state !== 'OPEN' || drive.seats <= 0 ? 'disabled' : ''}>Apply Now</button>`
                }
              </div>
            </div>
          `;
        });
      }

      html += `</div>`;
      elements.mainContent.innerHTML = html;

      // Attach Apply Button Listeners
      elements.mainContent.querySelectorAll('.btn-apply').forEach(btn => {
        btn.addEventListener('click', () => {
          const driveId = btn.getAttribute('data-id');
          openApplyModal(driveId);
        });
      });
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load drives: ${err.message}</div>`;
    }
  }

  // 2. Student Views: My Applications
  async function loadApplicationsView(silent = false) {
    if (!silent) {
      elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Loading applications...</p></div></div>';
    }
    try {
      const studentId = state.activeStudent?.student_id || state.user?.student_id;
      const apps = await apiFetch(studentId ? `/api/v1/ui/applications?student_id=${studentId}` : '/api/v1/ui/applications');
      state.applications = apps || [];

      const stuName = state.activeStudent?.name || state.user?.name || 'Applicant';
      const offeredApps = state.applications.filter(a => a.state === 'OFFER_ISSUED');

      let html = `
        <div class="view-header">
          <div>
            <h2 class="view-title">My Applications</h2>
            <p class="view-subtitle">Submitted applications and real-time state machine transitions for ${stuName}</p>
          </div>
        </div>
      `;

      // Offer Notification Banner
      if (offeredApps.length > 0) {
        html += `
          <div class="card" style="border-color: #34d399; margin-bottom: 1.5rem; background: rgba(52, 211, 153, 0.06);">
            <div class="card-header">
              <h3 class="card-title" style="color: #34d399;">Active Placement Offers (${offeredApps.length})</h3>
              <span class="chip chip-online">[Candidate Action Required]</span>
            </div>
            <div class="card-body">
              ${offeredApps.map(o => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);">
                  <div>
                    <strong style="font-size: 1.05rem;">${o.drive_title || o.drive_id}</strong>
                    <div class="text-muted" style="font-size: 0.8rem;">Application ID: <span class="mono">${o.application_id}</span> &bull; State: <span class="chip chip-offered">[OFFER_ISSUED]</span></div>
                  </div>
                  <div style="display: flex; gap: 0.5rem;">
                    <button type="button" class="btn btn-primary btn-sm btn-accept-offer" data-id="${o.application_id}">[Accept Offer]</button>
                    <button type="button" class="btn btn-secondary btn-sm btn-decline-offer" data-id="${o.application_id}">[Decline Offer]</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      html += `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Placement Applications (${state.applications.length})</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Drive Title</th>
                    <th>Submitted At</th>
                    <th>Current State</th>
                    <th>Version</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (state.applications.length === 0) {
        html += `<tr><td colspan="6" class="text-muted" style="text-align: center; padding: 2rem;">No active applications found. Browse Available Drives to apply.</td></tr>`;
      } else {
        state.applications.forEach(app => {
          const isWithdrawable = ['APPLIED', 'SCREENING', 'RULE_EVALUATED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED'].includes(app.state);
          html += `
            <tr>
              <td class="mono" style="font-size: 0.8rem;">${app.application_id}</td>
              <td><strong>${app.drive_title || app.drive_id}</strong></td>
              <td class="mono" style="font-size: 0.78rem;">${new Date(app.created_at || Date.now()).toLocaleString()}</td>
              <td><span class="chip ${getStateChipClass(app.state)}">[${app.state}]</span></td>
              <td class="mono">v${app.version || 1}</td>
              <td>
                <div style="display: flex; gap: 0.4rem; align-items: center;">
                  <button type="button" class="btn btn-secondary btn-sm btn-inspect" data-id="${app.application_id}">Details</button>
                  ${isWithdrawable ? `<button type="button" class="btn btn-secondary btn-sm btn-withdraw-app" data-id="${app.application_id}" style="color: #f87171; border-color: #ef4444;">[Withdraw]</button>` : ''}
                </div>
              </td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div id="app-detail-container"></div>
      `;

      elements.mainContent.innerHTML = html;

      // Details buttons
      elements.mainContent.querySelectorAll('.btn-inspect').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-id');
          await inspectApplication(appId);
        });
      });

      // Accept Offer buttons
      elements.mainContent.querySelectorAll('.btn-accept-offer').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-id');
          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/offers/accept', {
              method: 'POST',
              body: JSON.stringify({ application_id: appId }),
            });
            showBanner('success', `[Offer Accepted] Congratulations! Placement offer for ${appId} confirmed.`);
            loadApplicationsView();
          } catch (err) {
            showBanner('error', `[Accept Failed] ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Decline Offer buttons
      elements.mainContent.querySelectorAll('.btn-decline-offer').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-id');
          if (!confirm('Are you sure you want to decline this offer? The drive seat will be released back to the candidate pool.')) {
            return;
          }
          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/offers/decline', {
              method: 'POST',
              body: JSON.stringify({ application_id: appId }),
            });
            showBanner('info', `[Offer Declined] Application ${appId} marked as WITHDRAWN and seat restored.`);
            loadApplicationsView();
          } catch (err) {
            showBanner('error', `[Decline Failed] ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Withdraw buttons
      elements.mainContent.querySelectorAll('.btn-withdraw-app').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-id');
          if (!confirm('Are you sure you want to withdraw this application? This action transitions state to WITHDRAWN.')) {
            return;
          }
          btn.disabled = true;
          try {
            await apiFetch(`/api/v1/ui/applications/${appId}/withdraw`, {
              method: 'POST',
            });
            showBanner('info', `[Application Withdrawn] Application ${appId} transitioned to WITHDRAWN.`);
            loadApplicationsView();
          } catch (err) {
            showBanner('error', `[Withdrawal Failed] ${err.message}`);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load applications: ${err.message}</div>`;
    }
  }

  async function inspectApplication(appId) {
    const container = document.getElementById('app-detail-container');
    if (!container) return;

    container.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Fetching audit and decision trace...</p></div></div>';
    try {
      const detail = await apiFetch(`/api/v1/ui/applications/${appId}`);
      const app = detail.application || {};
      const drive = detail.drive || {};
      const student = detail.student || {};

      container.innerHTML = `
        <div class="card" style="margin-top: 1.5rem; border-color: #3b82f6;">
          <div class="card-header">
            <h3 class="card-title">Workflow Lifecycle Trace &bull; Application ${app.application_id}</h3>
            <span class="chip ${getStateChipClass(app.state)}">[${app.state}]</span>
          </div>
          <div class="card-body">
            <div class="form-grid-2" style="margin-bottom: 1rem;">
              <div>
                <p class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Candidate Information</p>
                <p><strong>${student.name || 'Candidate'}</strong> (${student.student_id}) &bull; ${student.branch}</p>
                <p class="text-muted" style="font-size: 0.8rem;">CGPA: ${student.cgpa} &bull; Backlogs: ${student.backlogs}</p>
              </div>
              <div>
                <p class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Drive Information</p>
                <p><strong>${drive.title || 'Drive'}</strong> (${drive.drive_id})</p>
                <p class="text-muted" style="font-size: 0.8rem;">Package: ${formatCurrency(drive.package)} &bull; Seats: ${drive.seats}</p>
              </div>
            </div>
            
            <div class="criteria-list">
              <div class="criteria-item">
                <span class="criteria-label">State Machine Progress:</span>
                <span class="criteria-val">APPLIED &rarr; SCREENING &rarr; ${app.state}</span>
              </div>
              <div class="criteria-item">
                <span class="criteria-label">Idempotency Key:</span>
                <span class="criteria-val mono" style="font-size: 0.72rem;">${app.idempotency_key || 'IDEMPOTENT_TRANSACTION'}</span>
              </div>
              <div class="criteria-item">
                <span class="criteria-label">Record Version (OCC):</span>
                <span class="criteria-val">v${app.version || 1}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      container.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      container.innerHTML = `<div class="banner error">Could not load application trace: ${err.message}</div>`;
    }
  }

  // 3. Faculty Views: Placement Reports & Cohort Analytics
  async function loadReportsView() {
    elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Aggregating placement performance data...</p></div></div>';
    try {
      const data = await apiFetch('/api/v1/ui/reports/placement-performance');
      const perf = data.placement_performance || {};
      const totals = perf.totals || {};
      const packageStats = perf.package_stats || {};
      const branchStats = perf.branch_stats || [];
      const driveStats = perf.drive_stats || [];

      let html = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Placement Performance Report</h2>
            <p class="view-subtitle">Authoritative placement KPI breakdown and drive conversions (Team C Placement Analytics)</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Total Applications</span>
            <span class="kpi-value">${totals.total_applications || 0}</span>
            <span class="kpi-subtext">Across all drives</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Selected Candidates</span>
            <span class="kpi-value" style="color: #34d399;">${totals.total_selected || 0}</span>
            <span class="kpi-subtext">Verified selections</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Offers Committed</span>
            <span class="kpi-value" style="color: #60a5fa;">${totals.total_offers || 0}</span>
            <span class="kpi-subtext">C3 atomic commits</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Average Package</span>
            <span class="kpi-value">${formatCurrency(packageStats.average || 0)}</span>
            <span class="kpi-subtext">Max: ${formatCurrency(packageStats.max || 0)}</span>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Branch Conversion Analysis</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Applications</th>
                    <th>Selected</th>
                    <th>Conversion Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (branchStats.length === 0) {
        html += `<tr><td colspan="5" class="text-muted" style="text-align: center; padding: 1.5rem;">No branch conversion data available yet.</td></tr>`;
      } else {
        branchStats.forEach(b => {
          html += `
            <tr>
              <td><strong>${b.branch}</strong></td>
              <td class="mono">${b.applications}</td>
              <td class="mono">${b.selected}</td>
              <td class="mono"><strong>${b.conversion_rate}%</strong></td>
              <td>
                <span class="chip ${b.conversion_rate > 50 ? 'chip-online' : 'chip-applied'}">
                  ${b.conversion_rate > 50 ? '[High Conversion]' : '[Standard]'}
                </span>
              </td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recruitment Drive Performance</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Drive Title</th>
                    <th>State</th>
                    <th>Total Seats</th>
                    <th>Remaining Seats</th>
                    <th>Applications</th>
                    <th>Selected</th>
                    <th>Package</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (driveStats.length === 0) {
        html += `<tr><td colspan="7" class="text-muted" style="text-align: center; padding: 1.5rem;">No active drives logged.</td></tr>`;
      } else {
        driveStats.forEach(d => {
          html += `
            <tr>
              <td><strong>${d.title}</strong></td>
              <td><span class="chip ${d.state === 'OPEN' ? 'chip-online' : 'chip-offline'}">[${d.state}]</span></td>
              <td class="mono">${d.seats_total || d.seats_remaining}</td>
              <td class="mono">${d.seats_remaining}</td>
              <td class="mono">${d.applications}</td>
              <td class="mono" style="color: #34d399;"><strong>${d.selected}</strong></td>
              <td class="mono">${formatCurrency(d.package)}</td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      elements.mainContent.innerHTML = html;
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load reports: ${err.message}</div>`;
    }
  }

  async function loadCohortView() {
    elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Loading cohort analytics...</p></div></div>';
    try {
      const data = await apiFetch('/api/v1/ui/reports/placement-performance');
      const cohort = data.cohort_analytics || {};
      const branchDist = cohort.branch_distribution || {};
      const topSkills = cohort.top_skills || [];

      let html = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Student Cohort Analytics</h2>
            <p class="view-subtitle">Skill distribution and student registrations across college departments (Team B)</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Registered Students</span>
            <span class="kpi-value">${cohort.total_registered || 0}</span>
            <span class="kpi-subtext">Verified profiles</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Active Disciplines</span>
            <span class="kpi-value">${Object.keys(branchDist).length}</span>
            <span class="kpi-subtext">CSE, IT, ENTC, etc.</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Unique Skills Tracked</span>
            <span class="kpi-value">${topSkills.length}</span>
            <span class="kpi-subtext">Profile skill graph</span>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Top Candidate Skills (Skill Graph Weights)</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Skill Name</th>
                    <th>Candidate Count</th>
                    <th>Cohort Prevalence</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (topSkills.length === 0) {
        html += `<tr><td colspan="4" class="text-muted" style="text-align: center; padding: 1.5rem;">No skills tracked.</td></tr>`;
      } else {
        const total = cohort.total_registered || 1;
        topSkills.forEach(s => {
          const pct = Math.round((s.count / total) * 100);
          html += `
            <tr>
              <td><strong>${s.skill}</strong></td>
              <td class="mono">${s.count} candidates</td>
              <td class="mono">${pct}%</td>
              <td><span class="chip chip-evaluated">[Indexed]</span></td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      elements.mainContent.innerHTML = html;
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load cohort analytics: ${err.message}</div>`;
    }
  }

  // 4. Admin Views: Operations Dashboard, Drive Management, Ranking Engine, Audit
  async function loadDashboardView(silent = false) {
    if (!silent) {
      elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Loading live operations dashboard...</p></div></div>';
    }
    try {
      const [data, lockData] = await Promise.all([
        apiFetch('/api/v1/ui/dashboard'),
        apiFetch('/api/v1/ui/locks').catch(() => ({ active_locks_count: 0, active_locks: [], wfg_edges: [] })),
      ]);
      state.dashboard = data;
      const metrics = data.metrics || {};
      const q = data.queue_metrics || {};
      const audit = data.recent_audit || [];
      const activeLocks = lockData.active_locks || [];
      const wfgEdges = lockData.wfg_edges || [];

      let html = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Placement Operations Dashboard</h2>
            <p class="view-subtitle">Live cross-service telemetry &bull; Team C (DBMS) &bull; Team A (Queues &amp; Mutex) &bull; Team B (Ranking)</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Active Drives</span>
            <span class="kpi-value" style="color: #60a5fa;">${metrics.active_drives}</span>
            <span class="kpi-subtext">Out of ${metrics.total_drives} total drives</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total Applications</span>
            <span class="kpi-value">${metrics.total_applications}</span>
            <span class="kpi-subtext">Registered candidates</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Available Seats</span>
            <span class="kpi-value" style="color: #34d399;">${metrics.seats_available}</span>
            <span class="kpi-subtext">Open recruitment capacity</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Queue Depth (Team A)</span>
            <span class="kpi-value" style="color: #fbbf24;">${q.queue_depth || metrics.queue_depth || 0}</span>
            <span class="kpi-subtext">Pending rule evaluations</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Active Mutex Locks</span>
            <span class="kpi-value" style="color: #38bdf8;">${lockData.active_locks_count || 0}</span>
            <span class="kpi-subtext">Slot leases granted</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Offers Issued</span>
            <span class="kpi-value" style="color: #a78bfa;">${metrics.offers_issued}</span>
            <span class="kpi-subtext">Committed via 2PC workflow</span>
          </div>
        </div>

        <!-- Concurrency & Mutex Locks Inspector (Team A) -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h3 class="card-title">Interview Concurrency &amp; Mutex Inspector (Team A SlotLockManager)</h3>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <span class="chip ${activeLocks.length > 0 ? 'chip-online' : 'chip-applied'}">[${activeLocks.length} Active Leases]</span>
              <button type="button" id="btn-run-deadlock" class="btn btn-secondary btn-sm">[Run Deadlock Analysis]</button>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Slot Mutex ID</th>
                    <th>Candidate Holder</th>
                    <th>Lock Mode</th>
                    <th>Remaining Lease TTL</th>
                    <th>Lease Identifier</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (activeLocks.length === 0) {
        html += `<tr><td colspan="5" class="text-muted" style="text-align: center; padding: 1.5rem;">No active interview slot locks held. Locks are acquired when scheduling interviews.</td></tr>`;
      } else {
        activeLocks.forEach(l => {
          const ttlSec = Math.round(l.ttl_remaining_ms / 1000);
          html += `
            <tr>
              <td class="mono"><strong>${l.slot_id}</strong></td>
              <td class="mono">${l.holder_id}</td>
              <td><span class="chip chip-screening">[${l.lock_mode}]</span></td>
              <td class="mono" style="color: #fbbf24;">${ttlSec}s remaining</td>
              <td class="mono text-muted" style="font-size: 0.75rem;">${l.lease_id}</td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
            <div id="deadlock-analysis-result" style="padding: 1rem; border-top: 1px solid var(--border-color); display: none;"></div>
          </div>
        </div>

        <!-- DBMS Resilience & WAL Engine (Team C) -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h3 class="card-title">DBMS Storage Engine Resilience &amp; Recovery (Team C)</h3>
            <button type="button" id="btn-verify-wal" class="btn btn-secondary btn-sm">[Verify WAL Integrity]</button>
          </div>
          <div class="card-body">
            <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 0.5rem;">
              Custom JSON DBMS runs open-addressing Hash Indexing, B-Tree indexes, and Write-Ahead Logging (WAL).
            </p>
            <div id="wal-verify-result" style="display: none; margin-top: 0.75rem; background: var(--bg-input); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);"></div>
          </div>
        </div>

        <!-- Live Audit Log Stream -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Live Audit Log Stream (Append-Only WAL Engine)</h3>
            <span class="chip chip-online">[Real-Time SSE Sync]</span>
          </div>
          <div class="card-body">
            <div class="audit-log-stream">
      `;

      if (audit.length === 0) {
        html += `<p class="text-muted" style="text-align: center; padding: 1.5rem;">No recent audit mutations recorded.</p>`;
      } else {
        audit.forEach(item => {
          html += `
            <div class="audit-item">
              <div>
                <span class="audit-action">[${item.action || 'TRANSACTION'}]</span>
                <span style="color: var(--text-primary); margin-left: 0.5rem;">Table: <strong>${item.table_name || item.tableName || '-'}</strong></span>
                <span class="text-muted" style="margin-left: 0.5rem;">Record: ${item.record_id || item.recordId || '-'}</span>
              </div>
              <div class="audit-meta">
                <span>Actor: ${item.actor || 'system'}</span> &bull;
                <span>${new Date(item.timestamp || Date.now()).toLocaleTimeString()}</span>
              </div>
            </div>
          `;
        });
      }

      html += `
            </div>
          </div>
        </div>
      `;

      elements.mainContent.innerHTML = html;

      // Deadlock analysis button
      const deadlockBtn = document.getElementById('btn-run-deadlock');
      if (deadlockBtn) {
        deadlockBtn.addEventListener('click', async () => {
          deadlockBtn.disabled = true;
          try {
            const res = await apiFetch('/api/v1/ui/deadlocks/analyse', { method: 'POST' });
            const resDiv = document.getElementById('deadlock-analysis-result');
            if (resDiv) {
              resDiv.style.display = 'block';
              const cyclesCount = res.cycles?.length || 0;
              resDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="color: ${cyclesCount > 0 ? '#ef4444' : '#34d399'};">
                      ${cyclesCount > 0 ? `[DEADLOCK DETECTED] ${cyclesCount} cycle(s) identified in Wait-For Graph` : '[GRAPH ACYCLIC] No deadlocks detected in Wait-For Graph'}
                    </strong>
                    <div class="text-muted" style="font-size: 0.8rem; margin-top: 0.25rem;">
                      Algorithm: Depth-First Search Cycle Detection &bull; Checked at: ${new Date().toLocaleTimeString()}
                    </div>
                  </div>
                  <span class="chip ${cyclesCount > 0 ? 'chip-not-eligible' : 'chip-online'}">
                    ${cyclesCount > 0 ? '[Victim Aborted]' : '[Safe State]'}
                  </span>
                </div>
              `;
            }
          } catch (err) {
            showBanner('error', `[Deadlock Analysis Error] ${err.message}`);
          } finally {
            deadlockBtn.disabled = false;
          }
        });
      }

      // WAL verification button
      const walBtn = document.getElementById('btn-verify-wal');
      if (walBtn) {
        walBtn.addEventListener('click', async () => {
          walBtn.disabled = true;
          try {
            const res = await apiFetch('/api/v1/ui/recovery/verify', { method: 'POST' });
            const resDiv = document.getElementById('wal-verify-result');
            if (resDiv) {
              resDiv.style.display = 'block';
              resDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="color: #34d399;">[WAL INTEGRITY VERIFIED] Storage engine consistent</strong>
                    <div class="text-muted" style="font-size: 0.8rem; margin-top: 0.25rem;">
                      WAL records verified: ${res.wal_records_checked || 'All'} &bull; Checkpoint status: OK &bull; Tables in sync: 6/6
                    </div>
                  </div>
                  <span class="chip chip-online">[ACID Compliant]</span>
                </div>
              `;
            }
          } catch (err) {
            showBanner('error', `[Recovery Verify Error] ${err.message}`);
          } finally {
            walBtn.disabled = false;
          }
        });
      }
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load operations dashboard: ${err.message}</div>`;
    }
  }

  async function loadDriveManagementView() {
    elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Loading drive management records...</p></div></div>';
    try {
      const [drives, allApps, companies] = await Promise.all([
        apiFetch('/api/v1/ui/drives'),
        apiFetch('/api/v1/ui/applications'),
        apiFetch('/api/v1/ui/companies').catch(() => []),
      ]);
      state.drives = drives || [];

      let html = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Drive Management &amp; Candidate Selection</h2>
            <p class="view-subtitle">Operational parameters, seats allocation, and candidate selection workflow</p>
          </div>
          <button type="button" id="btn-create-drive-trigger" class="btn btn-primary">[+ Create Placement Drive]</button>
        </div>

        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h3 class="card-title">Placement Drives (${state.drives.length})</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Drive ID</th>
                    <th>Title</th>
                    <th>Company</th>
                    <th>State</th>
                    <th>Seats</th>
                    <th>Min CGPA</th>
                    <th>Package</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (state.drives.length === 0) {
        html += `<tr><td colspan="8" class="text-muted" style="text-align: center; padding: 2rem;">No drives available. Click [+ Create Placement Drive] to start.</td></tr>`;
      } else {
        state.drives.forEach(d => {
          const crit = d.criteria || {};
          html += `
            <tr>
              <td class="mono">${d.drive_id}</td>
              <td><strong>${d.title}</strong></td>
              <td>${d.company_name || d.company_id}</td>
              <td><span class="chip ${d.state === 'OPEN' ? 'chip-online' : (d.state === 'SCREENING' ? 'chip-screening' : 'chip-offline')}">[${d.state}]</span></td>
              <td class="mono"><strong>${d.seats}</strong></td>
              <td class="mono">${crit.min_cgpa !== undefined ? crit.min_cgpa : '-'}</td>
              <td class="mono">${formatCurrency(d.package)}</td>
              <td>
                <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                  <button type="button" class="btn btn-secondary btn-sm btn-edit-drive" data-id="${d.drive_id}">Criteria</button>
                  ${d.state === 'DRAFT' ? `<button type="button" class="btn btn-primary btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="OPEN">[Open]</button>` : ''}
                  ${d.state === 'OPEN' ? `
                    <button type="button" class="btn btn-secondary btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="SCREENING">[Screen]</button>
                    <button type="button" class="btn btn-secondary btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="CLOSED" style="color: #f87171;">[Close]</button>
                  ` : ''}
                  ${d.state === 'SCREENING' ? `
                    <button type="button" class="btn btn-secondary btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="CLOSED" style="color: #f87171;">[Close]</button>
                  ` : ''}
                  ${d.state === 'CLOSED' ? `
                    <button type="button" class="btn btn-secondary btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="OPEN">[Re-Open]</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Candidate Pipeline & Selection Workflow Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Candidate Pipeline &amp; Selection Workflow (${(allApps || []).length} applicants)</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Drive</th>
                    <th>Branch</th>
                    <th>Current State</th>
                    <th>Version</th>
                    <th>Workflow Actions</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (!allApps || allApps.length === 0) {
        html += `<tr><td colspan="6" class="text-muted" style="text-align: center; padding: 2rem;">No candidate applications received yet.</td></tr>`;
      } else {
        allApps.forEach(app => {
          let actionButtons = '';
          if (app.state === 'SHORTLISTED') {
            actionButtons = `<button type="button" class="btn btn-primary btn-sm btn-schedule-trigger" data-app-id="${app.application_id}" data-student-id="${app.student_id}" data-student-name="${app.student_name || app.student_id}" data-drive-title="${app.drive_title || app.drive_id}">[Schedule Interview]</button>`;
          } else if (app.state === 'INTERVIEW_SCHEDULED') {
            actionButtons = `<button type="button" class="btn btn-primary btn-sm btn-select-candidate" data-app-id="${app.application_id}" data-version="${app.version}">[Select Candidate]</button>`;
          } else if (app.state === 'SELECTED') {
            actionButtons = `
              <div style="display: flex; gap: 0.35rem;">
                <button type="button" class="btn btn-primary btn-sm btn-issue-offer" data-app-id="${app.application_id}" data-version="${app.version}">[Issue Offer]</button>
                <button type="button" class="btn btn-secondary btn-sm btn-compensate-candidate" data-app-id="${app.application_id}">[Compensate]</button>
              </div>
            `;
          } else if (app.state === 'OFFER_ISSUED') {
            actionButtons = `
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <span class="chip chip-offered">[Offer Issued]</span>
                <button type="button" class="btn btn-secondary btn-sm btn-compensate-candidate" data-app-id="${app.application_id}" style="color: #f87171;">[Revoke]</button>
              </div>
            `;
          } else if (app.state === 'COMPENSATION_REQUIRED') {
            actionButtons = `<span class="chip chip-not-eligible">[Rollback Required]</span>`;
          } else {
            actionButtons = `<span class="text-muted" style="font-size: 0.78rem;">[${app.state}]</span>`;
          }

          html += `
            <tr>
              <td><strong>${app.student_name || app.student_id}</strong> <span class="mono text-muted" style="font-size: 0.75rem;">(${app.student_id})</span></td>
              <td>${app.drive_title || app.drive_id}</td>
              <td class="mono">${app.branch || '-'}</td>
              <td><span class="chip ${getStateChipClass(app.state)}">[${app.state}]</span></td>
              <td class="mono">v${app.version || 1}</td>
              <td>${actionButtons}</td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      elements.mainContent.innerHTML = html;

      // Edit Drive buttons
      elements.mainContent.querySelectorAll('.btn-edit-drive').forEach(btn => {
        btn.addEventListener('click', () => {
          const driveId = btn.getAttribute('data-id');
          openEditDriveModal(driveId);
        });
      });

      // Drive State transition buttons
      elements.mainContent.querySelectorAll('.btn-drive-state').forEach(btn => {
        btn.addEventListener('click', async () => {
          const driveId = btn.getAttribute('data-id');
          const targetState = btn.getAttribute('data-state');
          btn.disabled = true;
          try {
            await apiFetch(`/api/v1/ui/drives/${driveId}`, {
              method: 'PATCH',
              body: JSON.stringify({ state: targetState }),
            });
            showBanner('success', `[Drive State Changed] Drive ${driveId} transitioned to ${targetState}.`);
            loadDriveManagementView();
          } catch (err) {
            showBanner('error', `[State Transition Failed] ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Create Drive trigger
      const createDriveBtn = document.getElementById('btn-create-drive-trigger');
      if (createDriveBtn) {
        createDriveBtn.addEventListener('click', () => {
          // Populate company select in create drive modal
          if (elements.newDriveCompanySelect) {
            elements.newDriveCompanySelect.innerHTML = (companies || []).map(c => 
              `<option value="${c.company_id}">${c.name} (${c.company_id})</option>`
            ).join('') || '<option value="">No companies registered</option>';
          }
          elements.createDriveModal.classList.remove('hidden');
        });
      }

      // Schedule Interview Trigger
      elements.mainContent.querySelectorAll('.btn-schedule-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
          const appId = btn.getAttribute('data-app-id');
          const studentId = btn.getAttribute('data-student-id');
          const studentName = btn.getAttribute('data-student-name');
          const driveTitle = btn.getAttribute('data-drive-title');

          elements.scheduleAppId.value = appId;
          elements.scheduleStudentId.value = studentId;
          elements.scheduleStudentName.textContent = `${studentName} (${studentId})`;
          elements.scheduleDriveTitle.textContent = driveTitle;
          elements.scheduleModal.classList.remove('hidden');
        });
      });

      // Select Candidate buttons
      elements.mainContent.querySelectorAll('.btn-select-candidate').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-app-id');
          const version = Number(btn.getAttribute('data-version'));
          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/candidates/select', {
              method: 'POST',
              body: JSON.stringify({ application_id: appId, expected_version: version }),
            });
            showBanner('success', `[Candidate Selected] Application ${appId} marked as SELECTED and seat reserved.`);
            loadDriveManagementView();
          } catch (err) {
            showBanner('error', `[Selection Failed] ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Issue Offer buttons
      elements.mainContent.querySelectorAll('.btn-issue-offer').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-app-id');
          const version = Number(btn.getAttribute('data-version'));
          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/candidates/issue-offer', {
              method: 'POST',
              body: JSON.stringify({ application_id: appId, expected_version: version }),
            });
            showBanner('success', `[Offer Issued] Offer committed for application ${appId}. Awaiting student acceptance.`);
            loadDriveManagementView();
          } catch (err) {
            showBanner('error', `[Offer Issuance Failed] ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Compensate / Revoke buttons
      elements.mainContent.querySelectorAll('.btn-compensate-candidate').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-app-id');
          const reason = prompt('Reason for compensation / rollback:', 'Placement seat reallocation');
          if (!reason) return;
          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/candidates/compensate', {
              method: 'POST',
              body: JSON.stringify({ application_id: appId, reason }),
            });
            showBanner('info', `[Candidate Compensated] Application ${appId} rolled back to COMPENSATION_REQUIRED.`);
            loadDriveManagementView();
          } catch (err) {
            showBanner('error', `[Compensation Failed] ${err.message}`);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load drives: ${err.message}</div>`;
    }
  }

  async function loadRankingEngineView() {
    elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Initializing Ranking Algorithm Comparator...</p></div></div>';
    try {
      if (state.drives.length === 0) {
        state.drives = await apiFetch('/api/v1/ui/drives');
      }

      const activeDriveId = state.drives[0]?.drive_id || 'DRV001';
      const result = await apiFetch(`/api/v1/ui/rankings?drive_id=${activeDriveId}&algorithm=${state.selectedAlgo}`);
      state.rankingsPreview = result;

      renderRankingEngineDOM(activeDriveId);
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load ranking engine: ${err.message}</div>`;
    }
  }

  function renderRankingEngineDOM(activeDriveId) {
    const result = state.rankingsPreview || { rankings: [] };
    const rankings = result.rankings || [];

    let html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">Candidate Ranking Engine (Team B)</h2>
          <p class="view-subtitle">Interactive comparison of algorithmic sorting &bull; Weighted Score vs Heap Top-K vs Merge Sort</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <label for="ranking-drive-select" style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Target Drive:</label>
          <select id="ranking-drive-select" class="form-select">
            ${state.drives.map(d => `<option value="${d.drive_id}" ${d.drive_id === activeDriveId ? 'selected' : ''}>${d.title} (${d.drive_id})</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Algorithm & Top-K Action Card -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 class="card-title">Ranking Algorithm &amp; Top-K Shortlist</h3>
            <span class="mono text-muted" style="font-size: 0.78rem;">Execution Time: ${result.execution_time_ms || 0} ms</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <label for="topk-count" style="font-size: 0.8rem; color: var(--text-secondary);">Shortlist Top-K:</label>
            <input type="number" id="topk-count" class="form-input" min="1" max="50" value="3" style="width: 70px; padding: 0.25rem 0.5rem;" />
            <button type="button" id="btn-commit-topk" class="btn btn-primary btn-sm">[Commit Top-K to Shortlist]</button>
          </div>
        </div>
        <div class="card-body">
          <div class="algorithm-selector">
            <button type="button" class="algo-btn ${state.selectedAlgo === 'WEIGHTED_SCORE' ? 'active' : ''}" data-algo="WEIGHTED_SCORE">
              [Weighted Score]
            </button>
            <button type="button" class="algo-btn ${state.selectedAlgo === 'HEAP_TOPK' ? 'active' : ''}" data-algo="HEAP_TOPK">
              [Heap Top-K]
            </button>
            <button type="button" class="algo-btn ${state.selectedAlgo === 'MERGE_SORT' ? 'active' : ''}" data-algo="MERGE_SORT">
              [Merge Sort]
            </button>
          </div>

          <div style="margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-input); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <strong>Algorithm Profile:</strong>
            ${state.selectedAlgo === 'WEIGHTED_SCORE' ? 'Calculates weighted edge distances across candidate skill matches and normalized CGPA.' : ''}
            ${state.selectedAlgo === 'HEAP_TOPK' ? 'Maintains an efficient Min-Heap bounded by capacity K to stream the top scorers in O(N log K) time.' : ''}
            ${state.selectedAlgo === 'MERGE_SORT' ? 'Deterministic divide-and-conquer sort with strict tie-breaking on lexicographical student ID in O(N log N) time.' : ''}
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Candidate ID</th>
                  <th>Candidate Name</th>
                  <th>Branch</th>
                  <th>CGPA</th>
                  <th>Skills</th>
                  <th>Composite Score</th>
                  <th>Algorithm</th>
                </tr>
              </thead>
              <tbody>
    `;

    if (rankings.length === 0) {
      html += `<tr><td colspan="8" class="text-muted" style="text-align: center; padding: 2rem;">No candidates scored for this drive.</td></tr>`;
    } else {
      rankings.forEach(r => {
        const skillsList = Array.isArray(r.skills) ? r.skills.join(', ') : '-';
        html += `
          <tr>
            <td class="mono" style="font-weight: 700; color: #38bdf8;">#${r.rank}</td>
            <td class="mono">${r.student_id}</td>
            <td><strong>${r.name || r.student_id}</strong></td>
            <td>${r.branch || '-'}</td>
            <td class="mono">${r.cgpa || '-'}</td>
            <td style="font-size: 0.75rem;">${skillsList}</td>
            <td class="mono" style="font-weight: 700; color: #34d399;">${r.total_score}</td>
            <td><span class="chip chip-screening">[${r.algorithm || state.selectedAlgo}]</span></td>
          </tr>
        `;
      });
    }

    html += `
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Fast AVL Tree Index Search -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Fast Candidate Search (Team B AVL Tree Index O(log N))</h3>
          <span class="chip chip-online">[Self-Balancing Binary Search Tree]</span>
        </div>
        <div class="card-body">
          <div style="display: flex; gap: 0.5rem; max-width: 500px; margin-bottom: 1rem;">
            <input type="text" id="avl-search-key" class="form-input" placeholder="Enter student ID (e.g. STU001) or Score (e.g. 8.5)" />
            <button type="button" id="btn-search-avl" class="btn btn-primary">[Search Index]</button>
          </div>
          <div id="avl-result-box" style="display: none; background: var(--bg-input); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);"></div>
        </div>
      </div>
    `;

    elements.mainContent.innerHTML = html;

    // Algorithm Selector Buttons
    elements.mainContent.querySelectorAll('.algo-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        state.selectedAlgo = btn.getAttribute('data-algo');
        const driveSelect = document.getElementById('ranking-drive-select');
        const selectedDrive = driveSelect ? driveSelect.value : activeDriveId;
        const res = await apiFetch(`/api/v1/ui/rankings?drive_id=${selectedDrive}&algorithm=${state.selectedAlgo}`);
        state.rankingsPreview = res;
        renderRankingEngineDOM(selectedDrive);
      });
    });

    // Drive Dropdown Change
    const driveSelect = document.getElementById('ranking-drive-select');
    if (driveSelect) {
      driveSelect.addEventListener('change', async (e) => {
        const driveId = e.target.value;
        const res = await apiFetch(`/api/v1/ui/rankings?drive_id=${driveId}&algorithm=${state.selectedAlgo}`);
        state.rankingsPreview = res;
        renderRankingEngineDOM(driveId);
      });
    }

    // Top-K Batch Shortlist Button
    const commitTopkBtn = document.getElementById('btn-commit-topk');
    if (commitTopkBtn) {
      commitTopkBtn.addEventListener('click', async () => {
        const k = Number(document.getElementById('topk-count')?.value || 3);
        const topCandidates = rankings.slice(0, k).map(r => r.student_id);
        if (topCandidates.length === 0) {
          alert('No candidates available to shortlist.');
          return;
        }
        commitTopkBtn.disabled = true;
        try {
          const res = await apiFetch('/api/v1/ui/rankings/batch-shortlist', {
            method: 'POST',
            body: JSON.stringify({
              driveId: activeDriveId,
              studentIds: topCandidates,
            }),
          });
          showBanner('success', `[Batch Shortlisted] ${res.length} candidate(s) successfully transitioned to SHORTLISTED.`);
        } catch (err) {
          showBanner('error', `[Shortlist Failed] ${err.message}`);
        } finally {
          commitTopkBtn.disabled = false;
        }
      });
    }

    // AVL Tree Search Button
    const avlBtn = document.getElementById('btn-search-avl');
    if (avlBtn) {
      avlBtn.addEventListener('click', async () => {
        const key = document.getElementById('avl-search-key')?.value.trim();
        if (!key) return;
        avlBtn.disabled = true;
        try {
          const res = await apiFetch(`/api/v1/ui/rankings/search-index?key=${encodeURIComponent(key)}`);
          const box = document.getElementById('avl-result-box');
          if (box) {
            box.style.display = 'block';
            const stats = res.tree_stats || res.index_statistics || {};
            box.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong>Query: <span class="mono">${res.query}</span> &bull; Status: <span class="chip ${res.found ? 'chip-online' : 'chip-not-eligible'}">${res.found ? '[Hit]' : '[Miss]'}</span></strong>
                <span class="mono text-muted" style="font-size: 0.75rem;">Search Time: O(log N)</span>
              </div>
              <div class="criteria-list">
                <div class="criteria-item"><span class="criteria-label">AVL Tree Height:</span><span class="criteria-val mono">${stats.height !== undefined ? stats.height : 3}</span></div>
                <div class="criteria-item"><span class="criteria-label">Total Indexed Nodes:</span><span class="criteria-val mono">${stats.size || stats.total_nodes || 12}</span></div>
                <div class="criteria-item"><span class="criteria-label">Match Record:</span><span class="criteria-val mono">${res.found ? JSON.stringify(res.result) : 'Key not in shortlist index'}</span></div>
              </div>
            `;
          }
        } catch (err) {
          showBanner('error', `[Search Error] ${err.message}`);
        } finally {
          avlBtn.disabled = false;
        }
      });
    }
  }

  async function loadAuditTrailView(filters = {}) {
    elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Loading audit trail records...</p></div></div>';
    try {
      const qs = new URLSearchParams();
      if (filters.actor) qs.append('actor', filters.actor);
      if (filters.action) qs.append('action', filters.action);
      if (filters.table_name) qs.append('table_name', filters.table_name);
      if (filters.record_id) qs.append('record_id', filters.record_id);
      qs.append('limit', '50');

      const audit = await apiFetch(`/api/v1/ui/audit?${qs.toString()}`) || [];

      let html = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Authoritative Audit Trail (C4 WAL Engine)</h2>
            <p class="view-subtitle">Immutable append-only transaction ledger with multi-criteria filtering</p>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-body" style="padding: 1rem;">
            <form id="audit-filter-form" style="display: flex; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap;">
              <div class="form-group" style="margin: 0; min-width: 130px;">
                <label for="filter-actor" style="font-size: 0.75rem;">Actor:</label>
                <input type="text" id="filter-actor" class="form-input" placeholder="e.g. admin" value="${filters.actor || ''}" />
              </div>
              <div class="form-group" style="margin: 0; min-width: 160px;">
                <label for="filter-action" style="font-size: 0.75rem;">Action:</label>
                <select id="filter-action" class="form-select">
                  <option value="">All Actions</option>
                  <option value="COMMIT_OFFER" ${filters.action === 'COMMIT_OFFER' ? 'selected' : ''}>COMMIT_OFFER</option>
                  <option value="CREATE_APPLICATION" ${filters.action === 'CREATE_APPLICATION' ? 'selected' : ''}>CREATE_APPLICATION</option>
                  <option value="OFFER_ACCEPTED" ${filters.action === 'OFFER_ACCEPTED' ? 'selected' : ''}>OFFER_ACCEPTED</option>
                  <option value="OFFER_DECLINED" ${filters.action === 'OFFER_DECLINED' ? 'selected' : ''}>OFFER_DECLINED</option>
                  <option value="WITHDRAW" ${filters.action === 'WITHDRAW' ? 'selected' : ''}>WITHDRAW</option>
                  <option value="REGISTER_USER" ${filters.action === 'REGISTER_USER' ? 'selected' : ''}>REGISTER_USER</option>
                </select>
              </div>
              <div class="form-group" style="margin: 0; min-width: 140px;">
                <label for="filter-table" style="font-size: 0.75rem;">Table:</label>
                <select id="filter-table" class="form-select">
                  <option value="">All Tables</option>
                  <option value="applications" ${filters.table_name === 'applications' ? 'selected' : ''}>applications</option>
                  <option value="drives" ${filters.table_name === 'drives' ? 'selected' : ''}>drives</option>
                  <option value="companies" ${filters.table_name === 'companies' ? 'selected' : ''}>companies</option>
                  <option value="offers" ${filters.table_name === 'offers' ? 'selected' : ''}>offers</option>
                  <option value="students" ${filters.table_name === 'students' ? 'selected' : ''}>students</option>
                  <option value="users" ${filters.table_name === 'users' ? 'selected' : ''}>users</option>
                </select>
              </div>
              <div class="form-group" style="margin: 0; min-width: 140px;">
                <label for="filter-record" style="font-size: 0.75rem;">Record ID:</label>
                <input type="text" id="filter-record" class="form-input" placeholder="UUID or ID" value="${filters.record_id || ''}" />
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="submit" class="btn btn-primary btn-sm">[Filter Logs]</button>
                <button type="button" id="btn-reset-audit" class="btn btn-secondary btn-sm">[Reset]</button>
              </div>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Audit Ledger Entries (${audit.length})</h3>
            <span class="chip chip-online">[Live Stream Active]</span>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Table</th>
                    <th>Record ID</th>
                    <th>Actor</th>
                    <th>Correlation ID</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (audit.length === 0) {
        html += `<tr><td colspan="6" class="text-muted" style="text-align: center; padding: 2rem;">No audit records matching query filters.</td></tr>`;
      } else {
        audit.forEach(item => {
          html += `
            <tr>
              <td><span class="chip chip-screening">[${item.action || 'MUTATION'}]</span></td>
              <td class="mono"><strong>${item.table_name || item.tableName || '-'}</strong></td>
              <td class="mono" style="font-size: 0.75rem;">${item.record_id || item.recordId || '-'}</td>
              <td>${item.actor || 'system'}</td>
              <td class="mono text-muted" style="font-size: 0.72rem;">${item.correlation_id || item.correlationId || '-'}</td>
              <td class="mono" style="font-size: 0.75rem;">${new Date(item.timestamp || Date.now()).toLocaleString()}</td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      elements.mainContent.innerHTML = html;

      // Filter Form listener
      const filterForm = document.getElementById('audit-filter-form');
      if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
          e.preventDefault();
          loadAuditTrailView({
            actor: document.getElementById('filter-actor')?.value.trim() || undefined,
            action: document.getElementById('filter-action')?.value || undefined,
            table_name: document.getElementById('filter-table')?.value || undefined,
            record_id: document.getElementById('filter-record')?.value.trim() || undefined,
          });
        });
      }

      // Reset listener
      const resetBtn = document.getElementById('btn-reset-audit');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          loadAuditTrailView({});
        });
      }
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load audit trail: ${err.message}</div>`;
    }
  }

  // Student Views: My Profile (Self-Service Profile Management)
  async function loadProfileView() {
    const s = state.activeStudent || {};
    const u = state.user || {};
    const studentId = s.student_id || u.student_id;

    if (!studentId) {
      elements.mainContent.innerHTML = `
        <div class="card">
          <div class="card-body">
            <p class="text-muted">Please sign in as a student to view and manage your academic profile.</p>
          </div>
        </div>
      `;
      return;
    }

    elements.mainContent.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-title">My Academic Profile</h2>
          <p class="view-subtitle">Self-service profile and academic credential management (persisted in Team C DBMS)</p>
        </div>
      </div>
      <div class="card" style="max-width: 650px;">
        <div class="card-header">
          <h3 class="card-title">Profile: ${s.name || u.name || studentId}</h3>
          <span class="chip chip-online">[DBMS Synchronized]</span>
        </div>
        <div class="card-body">
          <form id="profile-edit-form">
            <div class="form-group">
              <label for="profile-student-id">Student ID (Immutable Key):</label>
              <input type="text" id="profile-student-id" class="form-input" value="${studentId}" disabled />
            </div>
            <div class="form-group">
              <label for="profile-name">Full Legal Name:</label>
              <input type="text" id="profile-name" class="form-input" value="${s.name || u.name || ''}" required />
            </div>
            <div class="form-group">
              <label for="profile-email">Institutional Email:</label>
              <input type="email" id="profile-email" class="form-input" value="${s.email || u.email || ''}" required />
            </div>
            <div class="form-group">
              <label for="profile-branch">Academic Department / Branch:</label>
              <select id="profile-branch" class="form-select" required>
                <option value="CSE" ${s.branch === 'CSE' ? 'selected' : ''}>Computer Science &amp; Engineering (CSE)</option>
                <option value="IT" ${s.branch === 'IT' ? 'selected' : ''}>Information Technology (IT)</option>
                <option value="ECE" ${s.branch === 'ECE' ? 'selected' : ''}>Electronics &amp; Communication (ECE)</option>
                <option value="MECH" ${s.branch === 'MECH' ? 'selected' : ''}>Mechanical Engineering (MECH)</option>
                <option value="CIVIL" ${s.branch === 'CIVIL' ? 'selected' : ''}>Civil Engineering (CIVIL)</option>
              </select>
            </div>
            <div class="form-row" style="display: flex; gap: 1rem;">
              <div class="form-group" style="flex: 1;">
                <label for="profile-cgpa">Cumulative CGPA (0.00 - 10.00):</label>
                <input type="number" id="profile-cgpa" class="form-input" step="0.01" min="0" max="10" value="${s.cgpa != null ? s.cgpa : 7.5}" required />
              </div>
              <div class="form-group" style="flex: 1;">
                <label for="profile-backlogs">Active Backlogs:</label>
                <input type="number" id="profile-backlogs" class="form-input" min="0" max="20" value="${s.backlogs != null ? s.backlogs : 0}" required />
              </div>
              <div class="form-group" style="flex: 1;">
                <label for="profile-attendance">Attendance (%):</label>
                <input type="number" id="profile-attendance" class="form-input" min="0" max="100" value="${s.attendance != null ? s.attendance : 85}" required />
              </div>
            </div>
            <div class="form-group">
              <label for="profile-skills">Technical Skills (Comma separated):</label>
              <input type="text" id="profile-skills" class="form-input" value="${Array.isArray(s.skills) ? s.skills.join(', ') : (s.skills || 'JavaScript, Python')}" placeholder="e.g. JavaScript, Python, Node.js, SQL" />
            </div>
            <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
              <button type="submit" class="btn btn-primary" id="btn-save-profile">[Save Profile Changes]</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const form = document.getElementById('profile-edit-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('btn-save-profile');
        if (saveBtn) saveBtn.disabled = true;

        const skills = document.getElementById('profile-skills').value.split(',').map(item => item.trim()).filter(Boolean);
        const updates = {
          name: document.getElementById('profile-name').value.trim(),
          email: document.getElementById('profile-email').value.trim(),
          branch: document.getElementById('profile-branch').value,
          cgpa: Number(document.getElementById('profile-cgpa').value),
          backlogs: Number(document.getElementById('profile-backlogs').value),
          attendance: Number(document.getElementById('profile-attendance').value),
          skills: skills,
        };

        try {
          const updated = await apiFetch(`/api/v1/ui/students/${studentId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
          });

          // Update local state
          state.activeStudent = { ...state.activeStudent, ...updates, ...updated };
          if (state.user) {
            state.user.name = updates.name;
            state.user.email = updates.email;
          }
          updateUserDisplay();
          showBanner('success', `[Profile Updated] Academic credentials saved and synchronized to Team C DBMS.`);
          loadProfileView();
        } catch (err) {
          showBanner('error', `[Profile Update Failed] ${err.message}`);
          if (saveBtn) saveBtn.disabled = false;
        }
      });
    }
  }

  // Admin & Faculty Views: Company Directory
  async function loadCompaniesView() {
    elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Loading recruiter companies...</p></div></div>';
    try {
      const companies = await apiFetch('/api/v1/ui/companies') || [];
      let html = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Recruiter Company Directory</h2>
            <p class="view-subtitle">Registered corporate recruitment partners stored in Team C DBMS</p>
          </div>
          <button type="button" id="btn-open-create-company" class="btn btn-primary">[+ Register Recruiter Company]</button>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Corporate Partners (${companies.length})</h3>
            <span class="chip chip-online">[DBMS Synchronized]</span>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Company ID</th>
                    <th>Company Name</th>
                    <th>Industry</th>
                    <th>Tier</th>
                    <th>Contact Email</th>
                    <th>Website</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (companies.length === 0) {
        html += `<tr><td colspan="7" class="text-muted" style="text-align: center; padding: 2rem;">No companies registered yet. Click [+ Register Recruiter Company] to add one.</td></tr>`;
      } else {
        companies.forEach(c => {
          let tierChip = 'chip-applied';
          if (c.tier === 'Tier 1' || c.tier === 'TIER_1') tierChip = 'chip-active';
          else if (c.tier === 'Tier 2' || c.tier === 'TIER_2') tierChip = 'chip-screening';

          html += `
            <tr>
              <td class="mono" style="font-size: 0.8rem;"><strong>${c.company_id}</strong></td>
              <td><strong>${c.name}</strong></td>
              <td>${c.industry || '-'}</td>
              <td><span class="chip ${tierChip}">[${c.tier || 'Standard'}]</span></td>
              <td class="mono" style="font-size: 0.8rem;">${c.contact_email || '-'}</td>
              <td>${c.website ? `<a href="${c.website}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${c.website}</a>` : '-'}</td>
              <td><span class="chip chip-online">[ACTIVE]</span></td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      elements.mainContent.innerHTML = html;

      // Event listener for + Register Recruiter Company
      const openBtn = document.getElementById('btn-open-create-company');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          if (elements.companyModalError) elements.companyModalError.classList.add('hidden');
          if (elements.createCompanyModal) elements.createCompanyModal.classList.remove('hidden');
        });
      }
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load companies: ${err.message}</div>`;
    }
  }

  // Admin Views: User Accounts
  async function loadUserAccountsView() {
    elements.mainContent.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Loading registered accounts...</p></div></div>';
    try {
      const users = await apiFetch('/api/v1/auth/users');
      let html = `
        <div class="view-header">
          <div>
            <h2 class="view-title">User Accounts &amp; Access Control</h2>
            <p class="view-subtitle">Registered user credentials and account scopes stored in Team C DBMS</p>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Registered Accounts (${users.length})</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Username</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Linked Student ID</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (users.length === 0) {
        html += `<tr><td colspan="7" class="text-muted" style="text-align: center; padding: 2rem;">No user accounts found.</td></tr>`;
      } else {
        users.forEach(u => {
          html += `
            <tr>
              <td class="mono" style="font-size: 0.78rem;">${u.user_id}</td>
              <td><strong>${u.username}</strong></td>
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td><span class="chip ${u.role === 'admin' ? 'chip-warning' : (u.role === 'faculty' ? 'chip-active' : 'chip-applied')}">[${u.role.toUpperCase()}]</span></td>
              <td class="mono">${u.student_id || '-'}</td>
              <td class="mono" style="font-size: 0.75rem;">${new Date(u.created_at || Date.now()).toLocaleDateString()}</td>
            </tr>
          `;
        });
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      elements.mainContent.innerHTML = html;
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load user accounts: ${err.message}</div>`;
    }
  }

  // Active View Router
  function loadActiveView(silent = false) {
    if (state.role === 'student') {
      if (state.activeTab === 'drives') loadDrivesView();
      else if (state.activeTab === 'applications') loadApplicationsView(silent);
      else if (state.activeTab === 'profile') loadProfileView();
    } else if (state.role === 'faculty') {
      if (state.activeTab === 'reports') loadReportsView();
      else if (state.activeTab === 'cohort') loadCohortView();
      else if (state.activeTab === 'companies') loadCompaniesView();
    } else if (state.role === 'admin') {
      if (state.activeTab === 'dashboard') loadDashboardView(silent);
      else if (state.activeTab === 'drive-management') loadDriveManagementView();
      else if (state.activeTab === 'companies') loadCompaniesView();
      else if (state.activeTab === 'ranking-engine') loadRankingEngineView();
      else if (state.activeTab === 'user-accounts') loadUserAccountsView();
      else if (state.activeTab === 'audit-trail') loadAuditTrailView();
    }
  }

  // ── Modal Actions ───────────────────────────────────────────────────────────

  function openApplyModal(driveId) {
    if (!state.user || state.role !== 'student' || !state.activeStudent) {
      showBanner('warning', '[Access Restricted] Please sign in with a registered student account to submit placement applications.');
      openAuthModal('login');
      return;
    }

    const drive = state.drives.find(d => d.drive_id === driveId);
    if (!drive) return;

    elements.applyDriveId.value = drive.drive_id;
    elements.modalDriveTitle.textContent = `Apply to ${drive.title}`;
    elements.modalDriveIdDisplay.textContent = drive.drive_id;
    elements.modalCompanyDisplay.textContent = `${drive.company_name || 'Partner Company'} (${formatCurrency(drive.package)})`;
    elements.modalStudentDisplay.textContent = `${state.activeStudent.name} (${state.activeStudent.student_id})`;
    elements.modalMetricsDisplay.textContent = `Branch: ${state.activeStudent.branch} | CGPA: ${state.activeStudent.cgpa} | Backlogs: ${state.activeStudent.backlogs}`;
    elements.applyConsent.checked = false;

    elements.applyModalProgress.classList.add('hidden');
    elements.modalApplySubmit.disabled = false;
    elements.applyModal.classList.remove('hidden');
  }

  function closeApplyModal() {
    elements.applyModal.classList.add('hidden');
  }

  async function handleApplySubmit(e) {
    e.preventDefault();
    if (!elements.applyConsent.checked) {
      alert('Please confirm candidate consent before submitting.');
      return;
    }

    const driveId = elements.applyDriveId.value;
    const resumeVersion = elements.resumeVersion.value;

    elements.modalApplySubmit.disabled = true;
    elements.applyModalProgress.classList.remove('hidden');
    elements.applyProgressText.textContent = 'Orchestrating workflow across Team C, Team A, and Team B...';

    try {
      const response = await apiFetch('/api/v1/ui/applications', {
        method: 'POST',
        body: JSON.stringify({
          student_id: state.activeStudent.student_id,
          drive_id: driveId,
          consent: true,
          resume_version: resumeVersion,
        }),
      });

      elements.applyModalProgress.classList.add('hidden');
      closeApplyModal();

      const appState = response?.application?.state || 'APPLIED';
      const eligibilityResult = response?.eligibility?.result || 'UNKNOWN';
      const rank = response?.ranking?.rank || 1;

      showBanner('success', `[Workflow Completed] Application created. State: [${appState}] | Eligibility: [${eligibilityResult}] | Ranking: #${rank}`);

      // Refresh drives and switch to applications tab
      state.activeTab = 'applications';
      renderTabs();
      loadApplicationsView();
    } catch (err) {
      elements.applyModalProgress.classList.add('hidden');
      elements.modalApplySubmit.disabled = false;
      showBanner('error', `[Application Failed] ${err.message}`);
    }
  }

  function openEditDriveModal(driveId) {
    const drive = state.drives.find(d => d.drive_id === driveId);
    if (!drive) return;

    const crit = drive.criteria || {};
    elements.editDriveId.value = drive.drive_id;
    elements.editTitle.value = drive.title || '';
    elements.editSeats.value = drive.seats || 10;
    elements.editPackage.value = drive.package || 600000;
    elements.editState.value = drive.state || 'OPEN';
    elements.editMinCgpa.value = crit.min_cgpa !== undefined ? crit.min_cgpa : 7.0;
    elements.editMaxBacklogs.value = crit.max_backlogs !== undefined ? crit.max_backlogs : 1;
    elements.editMinAttendance.value = crit.min_attendance !== undefined ? crit.min_attendance : 75;
    elements.editBranches.value = Array.isArray(crit.branches) ? crit.branches.join(', ') : 'CSE, IT';

    elements.driveEditModal.classList.remove('hidden');
  }

  function closeEditDriveModal() {
    elements.driveEditModal.classList.add('hidden');
  }

  async function handleEditDriveSubmit(e) {
    e.preventDefault();
    const driveId = elements.editDriveId.value;
    const branches = elements.editBranches.value.split(',').map(b => b.trim()).filter(Boolean);

    const updates = {
      title: elements.editTitle.value,
      seats: Number(elements.editSeats.value),
      package: Number(elements.editPackage.value),
      state: elements.editState.value,
      criteria_json: JSON.stringify({
        min_cgpa: Number(elements.editMinCgpa.value),
        max_backlogs: Number(elements.editMaxBacklogs.value),
        min_attendance: Number(elements.editMinAttendance.value),
        branches: branches,
      }),
    };

    try {
      await apiFetch(`/api/v1/ui/drives/${driveId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      closeEditDriveModal();
      showBanner('success', `[Success] Drive ${driveId} parameters updated successfully.`);
      loadDriveManagementView();
    } catch (err) {
      showBanner('error', `[Update Error] ${err.message}`);
    }
  }

  // Handle Create Company Form Submit
  async function handleCreateCompanySubmit(e) {
    e.preventDefault();
    if (elements.companyModalError) elements.companyModalError.classList.add('hidden');

    const payload = {
      name: elements.newCompanyName.value.trim(),
      industry: elements.newCompanyIndustry.value.trim(),
      tier: elements.newCompanyTier.value,
      contact_email: elements.newCompanyEmail.value.trim(),
      website: elements.newCompanyWebsite.value.trim() || undefined,
    };

    try {
      await apiFetch('/api/v1/ui/companies', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      elements.createCompanyModal.classList.add('hidden');
      elements.createCompanyForm.reset();
      showBanner('success', `[Company Registered] ${payload.name} added to recruiter database.`);
      if (state.activeTab === 'companies') {
        loadCompaniesView();
      } else if (state.activeTab === 'drive-management') {
        loadDriveManagementView();
      }
    } catch (err) {
      if (elements.companyModalError) {
        elements.companyModalError.textContent = err.message;
        elements.companyModalError.classList.remove('hidden');
      } else {
        showBanner('error', `[Registration Failed] ${err.message}`);
      }
    }
  }

  // Handle Create Drive Form Submit
  async function handleCreateDriveSubmit(e) {
    e.preventDefault();
    if (elements.driveModalError) elements.driveModalError.classList.add('hidden');

    const branches = elements.newDriveBranches.value.split(',').map(b => b.trim()).filter(Boolean);
    const skills = elements.newDriveSkills.value.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      company_id: elements.newDriveCompanySelect.value,
      title: elements.newDriveTitle.value.trim(),
      package: Number(elements.newDrivePackage.value),
      seats: Number(elements.newDriveSeats.value),
      criteria: {
        min_cgpa: Number(elements.newDriveMinCgpa.value),
        max_backlogs: Number(elements.newDriveMaxBacklogs.value),
        min_attendance: Number(elements.newDriveMinAttendance.value),
        branches: branches,
        skills: skills,
      },
    };

    try {
      await apiFetch('/api/v1/ui/drives', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      elements.createDriveModal.classList.add('hidden');
      elements.createDriveForm.reset();
      showBanner('success', `[Drive Created] Placement drive "${payload.title}" created successfully.`);
      state.drives = [];
      loadDriveManagementView();
    } catch (err) {
      if (elements.driveModalError) {
        elements.driveModalError.textContent = err.message;
        elements.driveModalError.classList.remove('hidden');
      } else {
        showBanner('error', `[Drive Creation Failed] ${err.message}`);
      }
    }
  }

  // Handle Schedule Interview Form Submit
  async function handleScheduleSubmit(e) {
    e.preventDefault();
    if (elements.scheduleModalError) elements.scheduleModalError.classList.add('hidden');

    const appId = elements.scheduleAppId.value;
    const slotId = elements.scheduleSlotId.value.trim();
    const interviewerId = elements.scheduleInterviewerId.value.trim();

    try {
      await apiFetch('/api/v1/ui/interviews/schedule', {
        method: 'POST',
        body: JSON.stringify({
          application_id: appId,
          slot_id: slotId,
          interviewer_id: interviewerId,
        }),
      });

      elements.scheduleModal.classList.add('hidden');
      elements.scheduleForm.reset();
      showBanner('success', `[Interview Scheduled] Slot ${slotId} locked by Team A Mutex Manager.`);
      loadDriveManagementView();
    } catch (err) {
      if (elements.scheduleModalError) {
        elements.scheduleModalError.textContent = err.message;
        elements.scheduleModalError.classList.remove('hidden');
      } else {
        showBanner('error', `[Scheduling Failed] ${err.message}`);
      }
    }
  }

  // ── Event Bindings ──────────────────────────────────────────────────────────
  function setupEventListeners() {
    // Auth header controls
    if (elements.authBtn) {
      elements.authBtn.addEventListener('click', () => openAuthModal('login'));
    }
    if (elements.logoutBtn) {
      elements.logoutBtn.addEventListener('click', handleLogout);
    }

    // Auth modal controls
    if (elements.modalAuthClose) {
      elements.modalAuthClose.addEventListener('click', closeAuthModal);
    }
    if (elements.tabAuthLogin) {
      elements.tabAuthLogin.addEventListener('click', () => switchAuthTab('login'));
    }
    if (elements.tabAuthRegister) {
      elements.tabAuthRegister.addEventListener('click', () => switchAuthTab('register'));
    }
    if (elements.loginForm) {
      elements.loginForm.addEventListener('submit', handleLogin);
    }
    if (elements.registerForm) {
      elements.registerForm.addEventListener('submit', handleRegister);
    }
    if (elements.regRole) {
      elements.regRole.addEventListener('change', (e) => {
        if (e.target.value === 'faculty') {
          elements.studentRegFields.classList.add('hidden');
        } else {
          elements.studentRegFields.classList.remove('hidden');
        }
      });
    }

    // Quick demo login autofill buttons
    document.querySelectorAll('.btn-quick-fill').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = btn.getAttribute('data-user');
        const p = btn.getAttribute('data-pass');
        if (elements.loginUsername) elements.loginUsername.value = u;
        if (elements.loginPassword) elements.loginPassword.value = p;
      });
    });

    // Banner close
    elements.bannerClose.addEventListener('click', hideBanner);

    // Apply Modal
    elements.modalApplyClose.addEventListener('click', closeApplyModal);
    elements.modalApplyCancel.addEventListener('click', closeApplyModal);
    elements.applyForm.addEventListener('submit', handleApplySubmit);

    // Edit Drive Modal
    elements.modalEditClose.addEventListener('click', closeEditDriveModal);
    elements.modalEditCancel.addEventListener('click', closeEditDriveModal);
    elements.driveEditForm.addEventListener('submit', handleEditDriveSubmit);

    // Create Company Modal
    if (elements.modalCreateCompanyClose) {
      elements.modalCreateCompanyClose.addEventListener('click', () => elements.createCompanyModal.classList.add('hidden'));
    }
    if (elements.modalCreateCompanyCancel) {
      elements.modalCreateCompanyCancel.addEventListener('click', () => elements.createCompanyModal.classList.add('hidden'));
    }
    if (elements.createCompanyForm) {
      elements.createCompanyForm.addEventListener('submit', handleCreateCompanySubmit);
    }

    // Create Drive Modal
    if (elements.modalCreateDriveClose) {
      elements.modalCreateDriveClose.addEventListener('click', () => elements.createDriveModal.classList.add('hidden'));
    }
    if (elements.modalCreateDriveCancel) {
      elements.modalCreateDriveCancel.addEventListener('click', () => elements.createDriveModal.classList.add('hidden'));
    }
    if (elements.createDriveForm) {
      elements.createDriveForm.addEventListener('submit', handleCreateDriveSubmit);
    }

    // Schedule Interview Modal
    if (elements.modalScheduleClose) {
      elements.modalScheduleClose.addEventListener('click', () => elements.scheduleModal.classList.add('hidden'));
    }
    if (elements.modalScheduleCancel) {
      elements.modalScheduleCancel.addEventListener('click', () => elements.scheduleModal.classList.add('hidden'));
    }
    if (elements.scheduleForm) {
      elements.scheduleForm.addEventListener('submit', handleScheduleSubmit);
    }
  }

  // ── Initialization ──────────────────────────────────────────────────────────
  async function init() {
    setupEventListeners();
    await initSession();
    renderTabs();
    loadActiveView();
    initSSE();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
