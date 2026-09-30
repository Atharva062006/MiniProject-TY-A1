/**
 * APNILEAP Placement Portal & Recruitment Automation
 * Multi-Page Light-Theme Client Application
 * Zero Technical Jargon — Professional Placement Management UX
 */

(function () {
  'use strict';

  // ── Global Application State ────────────────────────────────────────────────
  const state = {
    token: localStorage.getItem('apnileap_token') || null,
    user: null,
    role: 'student', // 'student' | 'faculty' | 'admin'
    activeStudent: null,
    drives: [],
    companies: [],
    applications: [],
    dashboard: null,
    reports: null,
    rankingsPreview: null,
    selectedAlgo: 'WEIGHTED_SCORE',
    activeDriveFilter: 'ALL',
    searchQuery: '',
    sseConnected: false,
    eventSource: null,
  };

  // ── Route Definitions ───────────────────────────────────────────────────────
  const ROUTES = {
    // Student Routes
    '#/student/drives': { role: 'student', title: 'Placement Drives', breadcrumb: 'Placement Drives', icon: 'briefcase', fn: loadDrivesView },
    '#/student/applications': { role: 'student', title: 'My Applications', breadcrumb: 'My Applications', icon: 'file-text', fn: loadApplicationsView },
    '#/student/profile': { role: 'student', title: 'My Profile', breadcrumb: 'My Profile', icon: 'user', fn: loadProfileView },

    // Faculty Routes
    '#/faculty/reports': { role: 'faculty', title: 'Placement Reports', breadcrumb: 'Placement Reports', icon: 'bar-chart', fn: loadReportsView },
    '#/faculty/students': { role: 'faculty', title: 'Student Directory', breadcrumb: 'Student Directory', icon: 'users', fn: loadCohortView },
    '#/faculty/companies': { role: 'faculty', title: 'Company Directory', breadcrumb: 'Company Directory', icon: 'building', fn: loadCompaniesView },

    // Admin Routes
    '#/admin/dashboard': { role: 'admin', title: 'Placement Dashboard', breadcrumb: 'Dashboard', icon: 'layout', fn: loadDashboardView },
    '#/admin/drives': { role: 'admin', title: 'Manage Drives', breadcrumb: 'Manage Drives', icon: 'briefcase', fn: loadDriveManagementView },
    '#/admin/companies': { role: 'admin', title: 'Company Directory', breadcrumb: 'Companies', icon: 'building', fn: loadCompaniesView },
    '#/admin/rankings': { role: 'admin', title: 'Candidate Rankings', breadcrumb: 'Candidate Rankings', icon: 'award', fn: loadRankingEngineView },
    '#/admin/users': { role: 'admin', title: 'User Management', breadcrumb: 'Users', icon: 'shield', fn: loadUserAccountsView },
    '#/admin/audit': { role: 'admin', title: 'Activity Log', breadcrumb: 'Activity Log', icon: 'activity', fn: loadAuditTrailView },
  };

  // Route Aliases for ease of typing/linking
  const ROUTE_ALIASES = {
    '#/drives': '#/student/drives',
    '#/applications': '#/student/applications',
    '#/profile': '#/student/profile',
    '#/reports': '#/faculty/reports',
    '#/cohort': '#/faculty/students',
    '#/students': '#/faculty/students',
    '#/dashboard': '#/admin/dashboard',
    '#/drive-management': '#/admin/drives',
    '#/companies': '#/admin/companies',
    '#/ranking-engine': '#/admin/rankings',
    '#/user-accounts': '#/admin/users',
    '#/audit-trail': '#/admin/audit',
  };

  const DEFAULT_ROUTE_FOR_ROLE = {
    student: '#/student/drives',
    faculty: '#/faculty/reports',
    admin: '#/admin/dashboard',
  };

  // ── DOM References ──────────────────────────────────────────────────────────
  const elements = {
    sidebar: document.getElementById('app-sidebar'),
    sidebarNavLinks: document.getElementById('sidebar-nav-links'),
    sidebarRoleBadge: document.getElementById('sidebar-role-badge'),
    sidebarUserAvatar: document.getElementById('sidebar-user-avatar'),
    sidebarUserName: document.getElementById('sidebar-user-name'),
    sidebarUserRole: document.getElementById('sidebar-user-role'),
    sidebarLogoutBtn: document.getElementById('sidebar-logout-btn'),
    mobileSidebarToggle: document.getElementById('mobile-sidebar-toggle'),

    breadcrumbCurrent: document.getElementById('breadcrumb-current'),
    connectionChip: document.getElementById('connection-chip'),
    lastUpdated: document.getElementById('last-updated'),
    userDisplayChip: document.getElementById('user-display-chip'),
    authBtn: document.getElementById('auth-btn'),
    logoutBtn: document.getElementById('logout-btn'),

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
    if (elements.lastUpdated) {
      const now = new Date();
      elements.lastUpdated.textContent = now.toTimeString().split(' ')[0];
    }
  }

  function showBanner(type, message) {
    if (!elements.banner || !elements.bannerText) return;
    elements.banner.className = `banner ${type}`;
    elements.bannerText.textContent = message;
    elements.banner.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hideBanner() {
    if (elements.banner) {
      elements.banner.classList.add('hidden');
    }
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
      case 'INTERVIEW_SCHEDULED': return 'chip-screening';
      case 'SELECTED': return 'chip-selected';
      case 'OFFER_ISSUED': return 'chip-offered';
      case 'OFFER_ACCEPTED': return 'chip-selected';
      case 'OFFER_DECLINED': return 'chip-withdrawn';
      case 'NOT_ELIGIBLE': return 'chip-not-eligible';
      case 'WITHDRAWN': return 'chip-withdrawn';
      case 'WAITLISTED': return 'chip-evaluated';
      case 'COMPENSATION_REQUIRED': return 'chip-not-eligible';
      case 'EXPIRED': return 'chip-withdrawn';
      default: return 'chip-applied';
    }
  }

  function getStateLabel(stateName) {
    switch (stateName) {
      case 'APPLIED': return 'Applied';
      case 'SCREENING': return 'Under Review';
      case 'RULE_EVALUATED': return 'Eligibility Checked';
      case 'SHORTLISTED': return 'Shortlisted';
      case 'INTERVIEW_SCHEDULED': return 'Interview Scheduled';
      case 'SELECTED': return 'Selected';
      case 'OFFER_ISSUED': return 'Offer Received';
      case 'OFFER_ACCEPTED': return 'Offer Accepted';
      case 'OFFER_DECLINED': return 'Offer Declined';
      case 'NOT_ELIGIBLE': return 'Not Eligible';
      case 'WITHDRAWN': return 'Withdrawn';
      case 'WAITLISTED': return 'Waitlisted';
      case 'COMPENSATION_REQUIRED': return 'Pending Review';
      case 'EXPIRED': return 'Expired';
      default: return stateName;
    }
  }

  function getIconSvg(name) {
    switch (name) {
      case 'briefcase':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
      case 'file-text':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
      case 'user':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      case 'bar-chart':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`;
      case 'users':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      case 'building':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="2"/><line x1="8" y1="6" x2="8.01" y2="6"/><line x1="16" y1="6" x2="16.01" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/><line x1="16" y1="18" x2="16.01" y2="18"/></svg>`;
      case 'layout':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`;
      case 'award':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`;
      case 'shield':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
      case 'activity':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
      default:
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
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

  // ── Router & Navigation ─────────────────────────────────────────────────────
  function getCurrentHash() {
    let hash = window.location.hash || '';
    if (ROUTE_ALIASES[hash]) {
      hash = ROUTE_ALIASES[hash];
      window.location.hash = hash;
    }
    return hash;
  }

  function handleRoute(silent = false) {
    let hash = getCurrentHash();
    let route = ROUTES[hash];

    // If route doesn't match or belongs to another role, fall back to default
    if (!route || route.role !== state.role) {
      const defaultHash = DEFAULT_ROUTE_FOR_ROLE[state.role] || '#/student/drives';
      if (window.location.hash !== defaultHash) {
        window.location.hash = defaultHash;
        return;
      }
      hash = defaultHash;
      route = ROUTES[hash];
    }

    // Update Header Breadcrumbs
    if (elements.breadcrumbCurrent && route) {
      elements.breadcrumbCurrent.textContent = route.breadcrumb;
    }

    // Update Sidebar Navigation state
    renderSidebar();

    // Call active view handler
    if (route && typeof route.fn === 'function') {
      route.fn(silent);
    }
  }

  function renderSidebar() {
    if (!elements.sidebarNavLinks) return;

    // Role badge in sidebar
    if (elements.sidebarRoleBadge) {
      const roleLabels = { student: 'Student Portal', faculty: 'Faculty / TPO', admin: 'Placement Admin' };
      elements.sidebarRoleBadge.textContent = roleLabels[state.role] || 'Guest Portal';
    }

    // User Profile Card in Sidebar Footer
    if (state.user) {
      const initials = (state.user.name || state.user.username || 'U')
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      if (elements.sidebarUserAvatar) elements.sidebarUserAvatar.textContent = initials;
      if (elements.sidebarUserName) elements.sidebarUserName.textContent = state.user.name || state.user.username;
      if (elements.sidebarUserRole) {
        elements.sidebarUserRole.textContent = state.role === 'admin'
          ? 'Administrator'
          : (state.role === 'faculty' ? 'Faculty Coordinator' : (state.activeStudent?.branch || 'Student'));
      }
      if (elements.sidebarLogoutBtn) elements.sidebarLogoutBtn.classList.remove('hidden');
    } else {
      if (elements.sidebarUserAvatar) elements.sidebarUserAvatar.textContent = 'G';
      if (elements.sidebarUserName) elements.sidebarUserName.textContent = 'Guest User';
      if (elements.sidebarUserRole) elements.sidebarUserRole.textContent = 'Click Sign In';
      if (elements.sidebarLogoutBtn) elements.sidebarLogoutBtn.classList.add('hidden');
    }

    // Build navigation items for the active role
    const currentHash = getCurrentHash();
    const roleRoutes = Object.entries(ROUTES).filter(([_, r]) => r.role === state.role);
    elements.sidebarNavLinks.innerHTML = '';

    roleRoutes.forEach(([hash, config]) => {
      const a = document.createElement('a');
      a.className = `nav-item ${hash === currentHash ? 'active' : ''}`;
      a.href = hash;
      a.innerHTML = `
        <span class="nav-item-icon">${getIconSvg(config.icon)}</span>
        <span>${config.title}</span>
      `;
      a.addEventListener('click', () => {
        if (elements.sidebar) {
          elements.sidebar.classList.remove('open');
        }
      });
      elements.sidebarNavLinks.appendChild(a);
    });
  }

  // ── SSE Live Event Stream Connection ────────────────────────────────────────
  function initSSE() {
    if (state.eventSource) {
      state.eventSource.close();
    }

    if (elements.connectionChip) {
      elements.connectionChip.className = 'status-chip chip-connecting';
      elements.connectionChip.innerHTML = `<span class="status-dot"></span><span class="status-label">Connecting...</span>`;
    }

    try {
      state.eventSource = new EventSource('/api/v1/ui/stream');

      state.eventSource.addEventListener('connected', () => {
        state.sseConnected = true;
        if (elements.connectionChip) {
          elements.connectionChip.className = 'status-chip chip-online';
          elements.connectionChip.innerHTML = `<span class="status-dot"></span><span class="status-label">Live</span>`;
        }
        updateTimestamp();
      });

      state.eventSource.addEventListener('audit', () => {
        updateTimestamp();
        const currentHash = getCurrentHash();
        if (currentHash === '#/admin/dashboard' || currentHash === '#/admin/audit') {
          handleRoute(true);
        } else if (state.role === 'student' && currentHash === '#/student/applications') {
          loadApplicationsView(true);
        }
      });

      state.eventSource.addEventListener('state_change', () => {
        updateTimestamp();
        const currentHash = getCurrentHash();
        if (currentHash === '#/admin/dashboard' || currentHash === '#/student/applications') {
          handleRoute(true);
        }
      });

      state.eventSource.onerror = () => {
        state.sseConnected = false;
        if (elements.connectionChip) {
          elements.connectionChip.className = 'status-chip chip-offline';
          elements.connectionChip.innerHTML = `<span class="status-dot"></span><span class="status-label">Offline</span>`;
        }
      };
    } catch (err) {
      if (elements.connectionChip) {
        elements.connectionChip.className = 'status-chip chip-offline';
        elements.connectionChip.innerHTML = `<span class="status-dot"></span><span class="status-label">Offline</span>`;
      }
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
        } else {
          handleLogout();
        }
      } catch (err) {
        console.warn('Session verification failed:', err.message);
        handleLogout();
      }
    }
    updateUserDisplay();
  }

  function updateUserDisplay() {
    if (state.user) {
      if (elements.userDisplayChip) {
        elements.userDisplayChip.textContent = `${state.user.name} (${state.user.role})`;
        elements.userDisplayChip.classList.remove('hidden');
      }
      if (elements.authBtn) elements.authBtn.classList.add('hidden');
      if (elements.logoutBtn) elements.logoutBtn.classList.remove('hidden');
    } else {
      if (elements.userDisplayChip) elements.userDisplayChip.classList.add('hidden');
      if (elements.authBtn) elements.authBtn.classList.remove('hidden');
      if (elements.logoutBtn) elements.logoutBtn.classList.add('hidden');
    }
    renderSidebar();
  }

  function handleLogout() {
    localStorage.removeItem('apnileap_token');
    state.token = null;
    state.user = null;
    state.role = 'student';
    state.activeStudent = null;
    updateUserDisplay();
    showBanner('info', `You've been signed out.`);
    window.location.hash = DEFAULT_ROUTE_FOR_ROLE['student'];
  }

  function openAuthModal(mode = 'login') {
    switchAuthTab(mode);
    if (elements.authModal) elements.authModal.classList.remove('hidden');
  }

  function closeAuthModal() {
    if (elements.authModal) elements.authModal.classList.add('hidden');
    if (elements.loginErrorMsg) elements.loginErrorMsg.classList.add('hidden');
    if (elements.registerErrorMsg) elements.registerErrorMsg.classList.add('hidden');
  }

  function switchAuthTab(mode) {
    if (mode === 'login') {
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
    if (elements.loginErrorMsg) elements.loginErrorMsg.classList.add('hidden');
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

      closeAuthModal();
      updateUserDisplay();
      showBanner('success', `Welcome back, ${res.user.name}!`);

      // Switch to the default page for this user's role
      window.location.hash = DEFAULT_ROUTE_FOR_ROLE[state.role] || '#/student/drives';
    } catch (err) {
      if (elements.loginErrorMsg) {
        elements.loginErrorMsg.textContent = err.message || 'Authentication failed';
        elements.loginErrorMsg.classList.remove('hidden');
      }
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (elements.registerErrorMsg) elements.registerErrorMsg.classList.add('hidden');

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
          student: studentData,
        }),
      });

      localStorage.setItem('apnileap_token', res.token);
      state.token = res.token;
      state.user = res.user;
      state.role = res.user.role;
      state.activeStudent = res.student || null;

      closeAuthModal();
      updateUserDisplay();
      showBanner('success', `Account created! Welcome, ${res.user.name}.`);
      window.location.hash = DEFAULT_ROUTE_FOR_ROLE[state.role] || '#/student/drives';
    } catch (err) {
      if (elements.registerErrorMsg) {
        elements.registerErrorMsg.textContent = err.message || 'Registration failed';
        elements.registerErrorMsg.classList.remove('hidden');
      }
    }
  }

  // =========================================================================
  // VIEW RENDERERS (MULTI-PAGE VIEWS)
  // =========================================================================

  // 1. Student View: Available Placement Drives
  async function loadDrivesView() {
    elements.mainContent.innerHTML = `
      <div class="card">
        <p class="text-muted" style="padding: 1.5rem; text-align: center;">Loading available placement opportunities...</p>
      </div>
    `;

    try {
      const studentId = state.activeStudent?.student_id || state.user?.student_id;
      const [drives, myApps] = await Promise.all([
        apiFetch('/api/v1/ui/drives'),
        studentId ? apiFetch(`/api/v1/ui/applications?student_id=${studentId}`) : Promise.resolve([]),
      ]);
      state.drives = drives || [];
      state.applications = myApps || [];

      const appliedMap = new Map((myApps || []).map(a => [a.drive_id, a]));
      const stuName = state.activeStudent?.name || state.user?.name || 'Candidate';

      // Filter and search logic
      const filteredDrives = state.drives.filter(drive => {
        if (state.activeDriveFilter === 'DREAM' && (drive.package || 0) < 1500000) return false;
        if (state.activeDriveFilter === 'TIER1' && (drive.package || 0) < 800000) return false;
        if (state.activeDriveFilter === 'ELIGIBLE' && state.activeStudent) {
          const crit = drive.criteria || {};
          const isBranchEligible = !crit.branches || crit.branches.includes(state.activeStudent.branch);
          const isCgpaEligible = crit.min_cgpa === undefined || state.activeStudent.cgpa >= crit.min_cgpa;
          const isBacklogEligible = crit.max_backlogs === undefined || state.activeStudent.backlogs <= crit.max_backlogs;
          if (!isBranchEligible || !isCgpaEligible || !isBacklogEligible) return false;
        }
        if (state.searchQuery) {
          const q = state.searchQuery.toLowerCase();
          const matchTitle = (drive.title || '').toLowerCase().includes(q);
          const matchCompany = (drive.company_name || '').toLowerCase().includes(q);
          if (!matchTitle && !matchCompany) return false;
        }
        return true;
      });

      let html = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Available Placement Drives</h1>
            <p class="page-subtitle">Explore verified campus recruitment opportunities and apply directly.</p>
          </div>
          <div class="page-actions">
            ${!state.user ? `<button type="button" class="btn btn-primary btn-sm btn-quick-login">Sign In to Apply</button>` : ''}
          </div>
        </div>

        <!-- Filter & Search Bar -->
        <div class="filter-bar">
          <div class="filter-group">
            <button type="button" class="filter-pill ${state.activeDriveFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All Drives (${state.drives.length})</button>
            <button type="button" class="filter-pill ${state.activeDriveFilter === 'ELIGIBLE' ? 'active' : ''}" data-filter="ELIGIBLE">Eligible For You</button>
            <button type="button" class="filter-pill ${state.activeDriveFilter === 'DREAM' ? 'active' : ''}" data-filter="DREAM">Dream Offers (15+ LPA)</button>
            <button type="button" class="filter-pill ${state.activeDriveFilter === 'TIER1' ? 'active' : ''}" data-filter="TIER1">Tier 1</button>
          </div>
          <div class="search-input-group">
            <span class="search-icon-pos">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input type="text" id="drive-search-input" class="search-input" placeholder="Search by role or company..." value="${state.searchQuery}" />
          </div>
        </div>

        <div class="drives-grid">
      `;

      if (filteredDrives.length === 0) {
        html += `
          <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem;">
            <p style="font-weight: 600; color: var(--text-primary); font-size: 1.05rem;">No matching placement drives found</p>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">Try adjusting your filter or search keywords to view other opportunities.</p>
          </div>
        `;
      } else {
        filteredDrives.forEach(drive => {
          const applied = appliedMap.get(drive.drive_id);
          const crit = drive.criteria || {};
          const branches = Array.isArray(crit.branches) ? crit.branches.join(', ') : 'All Branches';
          const minCgpa = crit.min_cgpa !== undefined ? crit.min_cgpa : 'None';
          const maxBacklogs = crit.max_backlogs !== undefined ? crit.max_backlogs : 'None';
          const skillsList = Array.isArray(crit.skills) ? crit.skills.slice(0, 3).join(', ') : 'Open';

          const isBranchEligible = !state.activeStudent || !crit.branches || crit.branches.includes(state.activeStudent.branch);
          const isCgpaEligible = !state.activeStudent || crit.min_cgpa === undefined || state.activeStudent.cgpa >= crit.min_cgpa;
          const isBacklogEligible = !state.activeStudent || crit.max_backlogs === undefined || state.activeStudent.backlogs <= crit.max_backlogs;
          const preEligible = isBranchEligible && isCgpaEligible && isBacklogEligible;

          const companyInitials = (drive.company_name || 'CO').slice(0, 2).toUpperCase();

          html += `
            <div class="drive-card">
              <div class="drive-top">
                <div class="company-monogram">${companyInitials}</div>
                <div class="drive-meta">
                  <div class="drive-company-name">${drive.company_name || 'Partner Recruiter'}</div>
                  <h2 class="drive-title-text">${drive.title}</h2>
                </div>
                <span class="chip ${drive.state === 'OPEN' ? 'chip-selected' : (drive.state === 'SCREENING' ? 'chip-screening' : 'chip-withdrawn')}">
                  ${drive.state === 'OPEN' ? 'Open' : (drive.state === 'SCREENING' ? 'Screening' : 'Closed')}
                </span>
              </div>

              <div class="drive-details-box">
                <div class="drive-detail-row">
                  <span class="drive-detail-label">Annual Package</span>
                  <span class="drive-detail-val package-highlight">${formatCurrency(drive.package)}</span>
                </div>
                <div class="drive-detail-row">
                  <span class="drive-detail-label">Openings Available</span>
                  <span class="drive-detail-val">${drive.seats || 0} seats</span>
                </div>
                <div class="drive-detail-row">
                  <span class="drive-detail-label">Min CGPA Required</span>
                  <span class="drive-detail-val">${minCgpa}</span>
                </div>
                <div class="drive-detail-row">
                  <span class="drive-detail-label">Eligible Branches</span>
                  <span class="drive-detail-val" style="font-size: 0.75rem;">${branches}</span>
                </div>
              </div>

              <div class="criteria-tags">
                <span class="criteria-tag">Backlogs: &le; ${maxBacklogs}</span>
                <span class="criteria-tag">Skills: ${skillsList}</span>
              </div>

              <div class="drive-card-footer">
                <span class="chip ${preEligible ? 'chip-selected' : 'chip-withdrawn'}">
                  ${preEligible ? 'Eligible' : 'Requirements Not Met'}
                </span>
                ${applied
                  ? `<span class="chip ${getStateChipClass(applied.state)}">${getStateLabel(applied.state)}</span>`
                  : `<button type="button" class="btn btn-primary btn-sm btn-apply" data-id="${drive.drive_id}" ${drive.state !== 'OPEN' || (drive.seats || 0) <= 0 ? 'disabled' : ''}>Apply Now</button>`
                }
              </div>
            </div>
          `;
        });
      }

      html += `</div>`;
      elements.mainContent.innerHTML = html;

      // Filter Pill Listeners
      elements.mainContent.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          state.activeDriveFilter = btn.getAttribute('data-filter');
          loadDrivesView();
        });
      });

      // Search Input Listener
      const searchInput = document.getElementById('drive-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          state.searchQuery = e.target.value;
          // Debounced re-render
          clearTimeout(searchInput._timer);
          searchInput._timer = setTimeout(() => loadDrivesView(), 250);
        });
      }

      // Apply Button Listeners
      elements.mainContent.querySelectorAll('.btn-apply').forEach(btn => {
        btn.addEventListener('click', () => {
          const driveId = btn.getAttribute('data-id');
          openApplyModal(driveId);
        });
      });

      // Quick Login Button Listener
      const quickLoginBtn = elements.mainContent.querySelector('.btn-quick-login');
      if (quickLoginBtn) {
        quickLoginBtn.addEventListener('click', () => openAuthModal('login'));
      }
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load drives: ${err.message}</div>`;
    }
  }

  // 2. Student View: My Applications
  async function loadApplicationsView(silent = false) {
    if (!silent) {
      elements.mainContent.innerHTML = `
        <div class="card">
          <p class="text-muted" style="padding: 1.5rem; text-align: center;">Retrieving your application history...</p>
        </div>
      `;
    }

    try {
      const studentId = state.activeStudent?.student_id || state.user?.student_id;
      const apps = await apiFetch(studentId ? `/api/v1/ui/applications?student_id=${studentId}` : '/api/v1/ui/applications');
      state.applications = apps || [];

      const offeredApps = state.applications.filter(a => a.state === 'OFFER_ISSUED');

      let html = `
        <div class="page-header">
          <div>
            <h1 class="page-title">My Applications</h1>
            <p class="page-subtitle">Track the status of your submissions, interview rounds, and placement offers.</p>
          </div>
          <div class="page-actions">
            <a href="#/student/drives" class="btn btn-outline btn-sm">Browse More Drives</a>
          </div>
        </div>
      `;

      // Celebratory Offer Action Card
      if (offeredApps.length > 0) {
        offeredApps.forEach(o => {
          html += `
            <div class="offer-action-card">
              <div class="offer-action-text">
                <h4>Placement Offer Received!</h4>
                <p>Congratulations! <strong>${o.drive_title || o.drive_id}</strong> has extended a formal employment offer. Please confirm your decision below.</p>
              </div>
              <div class="offer-action-buttons">
                <button type="button" class="btn btn-success btn-sm btn-accept-offer" data-id="${o.application_id}">Accept Offer</button>
                <button type="button" class="btn btn-danger btn-sm btn-decline-offer" data-id="${o.application_id}">Decline</button>
              </div>
            </div>
          `;
        });
      }

      html += `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Recruitment Drive</th>
                <th>Applied Date</th>
                <th>Current Status</th>
                <th>Progress Step</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (state.applications.length === 0) {
        html += `
          <tr>
            <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
              You have not applied to any recruitment drives yet. <br />
              <a href="#/student/drives" style="color: var(--primary); font-weight: 600; text-decoration: underline; margin-top: 0.5rem; display: inline-block;">Browse Available Drives</a>
            </td>
          </tr>
        `;
      } else {
        state.applications.forEach(app => {
          const isWithdrawable = ['APPLIED', 'SCREENING', 'RULE_EVALUATED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED'].includes(app.state);

          // Calculate stepper step index (1 to 5)
          let stepIndex = 1;
          if (app.state === 'SCREENING' || app.state === 'RULE_EVALUATED') stepIndex = 2;
          else if (app.state === 'SHORTLISTED') stepIndex = 3;
          else if (app.state === 'INTERVIEW_SCHEDULED') stepIndex = 4;
          else if (['SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED'].includes(app.state)) stepIndex = 5;

          html += `
            <tr>
              <td>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${app.drive_title || app.drive_id}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${app.application_id.slice(0, 12)}...</div>
              </td>
              <td style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(app.created_at || Date.now()).toLocaleDateString()}</td>
              <td><span class="chip ${getStateChipClass(app.state)}">${getStateLabel(app.state)}</span></td>
              <td>
                <div style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">
                  Step ${stepIndex} of 5 &bull; <span style="color: var(--primary);">${getStateLabel(app.state)}</span>
                </div>
              </td>
              <td>
                <div style="display: flex; gap: 0.4rem; align-items: center;">
                  <button type="button" class="btn btn-outline btn-sm btn-inspect" data-id="${app.application_id}">View Details</button>
                  ${isWithdrawable ? `<button type="button" class="btn btn-outline btn-sm btn-withdraw-app" data-id="${app.application_id}" style="color: var(--status-rose-text); border-color: var(--status-rose-border);">Withdraw</button>` : ''}
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
        <div id="app-detail-container"></div>
      `;

      elements.mainContent.innerHTML = html;

      // Details view handler
      elements.mainContent.querySelectorAll('.btn-inspect').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-id');
          await inspectApplication(appId);
        });
      });

      // Accept Offer handler
      elements.mainContent.querySelectorAll('.btn-accept-offer').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-id');
          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/offers/accept', {
              method: 'POST',
              body: JSON.stringify({ application_id: appId }),
            });
            showBanner('success', `Offer accepted! Congratulations on your placement.`);
            loadApplicationsView();
          } catch (err) {
            showBanner('error', `Failed to accept offer: ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Decline Offer handler
      elements.mainContent.querySelectorAll('.btn-decline-offer').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-id');
          if (!confirm('Are you sure you want to decline this offer? The position will be released to other candidates.')) {
            return;
          }
          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/offers/decline', {
              method: 'POST',
              body: JSON.stringify({ application_id: appId }),
            });
            showBanner('info', `Offer declined.`);
            loadApplicationsView();
          } catch (err) {
            showBanner('error', `Failed to decline offer: ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Withdraw button handler
      elements.mainContent.querySelectorAll('.btn-withdraw-app').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-id');
          if (!confirm('Are you sure you want to withdraw this application? This action cannot be reversed.')) {
            return;
          }
          btn.disabled = true;
          try {
            await apiFetch(`/api/v1/ui/applications/${appId}/withdraw`, {
              method: 'POST',
            });
            showBanner('info', `Application withdrawn successfully.`);
            loadApplicationsView();
          } catch (err) {
            showBanner('error', `Failed to withdraw: ${err.message}`);
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

    container.innerHTML = '<div class="card" style="margin-top: 1.5rem;"><p class="text-muted" style="text-align: center; padding: 1rem;">Loading application details...</p></div>';

    try {
      const detail = await apiFetch(`/api/v1/ui/applications/${appId}`);
      const app = detail.application || {};
      const drive = detail.drive || {};
      const student = detail.student || {};

      container.innerHTML = `
        <div class="card" style="margin-top: 1.5rem; border-color: var(--primary-border);">
          <div class="card-header">
            <div>
              <h3 class="card-title">Application Status Details</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">Application Reference: ${app.application_id || appId}</p>
            </div>
            <span class="chip ${getStateChipClass(app.state)}">${getStateLabel(app.state)}</span>
          </div>
          <div class="card-body">
            <div class="form-grid-2" style="margin-bottom: 1.25rem;">
              <div class="detail-box">
                <div class="detail-item">
                  <span class="detail-label">Candidate</span>
                  <span class="detail-value">${student.name || 'Candidate'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Department</span>
                  <span class="detail-value">${student.branch || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">CGPA / Backlogs</span>
                  <span class="detail-value">${student.cgpa || '-'} / ${student.backlogs || 0}</span>
                </div>
              </div>
              <div class="detail-box">
                <div class="detail-item">
                  <span class="detail-label">Drive</span>
                  <span class="detail-value">${drive.title || 'Drive'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Offered Package</span>
                  <span class="detail-value" style="color: var(--primary);">${formatCurrency(drive.package)}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Total Openings</span>
                  <span class="detail-value">${drive.seats || '-'}</span>
                </div>
              </div>
            </div>

            <div class="detail-box">
              <div class="detail-item">
                <span class="detail-label">Current Pipeline Status</span>
                <span class="detail-value">${getStateLabel(app.state)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Submission Date</span>
                <span class="detail-value">${new Date(app.created_at || Date.now()).toLocaleString()}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Submitted Resume</span>
                <span class="detail-value">${app.resume_version || 'v1.0 General Profile'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      container.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      container.innerHTML = `<div class="banner error" style="margin-top: 1rem;">Could not load application details: ${err.message}</div>`;
    }
  }

  // 3. Student View: My Profile
  async function loadProfileView() {
    const s = state.activeStudent || {};
    const u = state.user || {};
    const studentId = s.student_id || u.student_id;

    if (!studentId) {
      elements.mainContent.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem 1.5rem;">
          <p style="font-weight: 600; font-size: 1.05rem;">Student Profile Unavailable</p>
          <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.25rem;">Please sign in with a registered student account to view and update your academic profile.</p>
          <button type="button" class="btn btn-primary btn-sm btn-quick-login" style="margin-top: 1rem;">Sign In</button>
        </div>
      `;
      elements.mainContent.querySelector('.btn-quick-login')?.addEventListener('click', () => openAuthModal('login'));
      return;
    }

    elements.mainContent.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">My Profile</h1>
          <p class="page-subtitle">Manage your verified academic credentials and career preferences.</p>
        </div>
      </div>

      <div class="profile-grid">
        <!-- Left Profile Identity Card -->
        <div class="card profile-card-user">
          <div class="profile-avatar-large">
            ${(s.name || u.name || 'S').slice(0, 2).toUpperCase()}
          </div>
          <h2 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">${s.name || u.name}</h2>
          <p style="font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.15rem;">${s.branch || 'Engineering'} &bull; ${s.student_id || studentId}</p>

          <div style="width: 100%; margin-top: 1.5rem; text-align: left;" class="detail-box">
            <div class="detail-item">
              <span class="detail-label">Current CGPA</span>
              <span class="detail-value" style="color: var(--primary); font-size: 1rem;">${s.cgpa != null ? s.cgpa : 7.5}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Active Backlogs</span>
              <span class="detail-value">${s.backlogs != null ? s.backlogs : 0}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Attendance</span>
              <span class="detail-value">${s.attendance != null ? s.attendance : 85}%</span>
            </div>
          </div>
        </div>

        <!-- Right Profile Edit Form -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Academic Credentials</h3>
          </div>
          <div class="card-body">
            <form id="profile-edit-form">
              <div class="form-grid-2">
                <div class="form-group">
                  <label for="profile-name" class="form-label">Full Name</label>
                  <input type="text" id="profile-name" class="form-input" value="${s.name || u.name || ''}" required />
                </div>
                <div class="form-group">
                  <label for="profile-email" class="form-label">College Email</label>
                  <input type="email" id="profile-email" class="form-input" value="${s.email || u.email || ''}" required />
                </div>
              </div>

              <div class="form-group">
                <label for="profile-branch" class="form-label">Department / Branch</label>
                <select id="profile-branch" class="form-select" required>
                  <option value="CSE" ${s.branch === 'CSE' ? 'selected' : ''}>Computer Science &amp; Engineering (CSE)</option>
                  <option value="IT" ${s.branch === 'IT' ? 'selected' : ''}>Information Technology (IT)</option>
                  <option value="ENTC" ${s.branch === 'ENTC' ? 'selected' : ''}>Electronics &amp; Telecommunication (ENTC)</option>
                  <option value="Mechanical" ${s.branch === 'Mechanical' ? 'selected' : ''}>Mechanical Engineering</option>
                  <option value="Electrical" ${s.branch === 'Electrical' ? 'selected' : ''}>Electrical Engineering</option>
                </select>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label for="profile-cgpa" class="form-label">CGPA (0 – 10)</label>
                  <input type="number" id="profile-cgpa" class="form-input" step="0.01" min="0" max="10" value="${s.cgpa != null ? s.cgpa : 7.5}" required />
                </div>
                <div class="form-group">
                  <label for="profile-backlogs" class="form-label">Active Backlogs</label>
                  <input type="number" id="profile-backlogs" class="form-input" min="0" max="20" value="${s.backlogs != null ? s.backlogs : 0}" required />
                </div>
              </div>

              <div class="form-group">
                <label for="profile-attendance" class="form-label">Attendance (%)</label>
                <input type="number" id="profile-attendance" class="form-input" min="0" max="100" value="${s.attendance != null ? s.attendance : 85}" required />
              </div>

              <div class="form-group">
                <label for="profile-skills" class="form-label">Key Skills (comma separated)</label>
                <input type="text" id="profile-skills" class="form-input" value="${Array.isArray(s.skills) ? s.skills.join(', ') : (s.skills || 'JavaScript, Python')}" placeholder="e.g. JavaScript, Python, SQL, Cloud" />
              </div>

              <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
                <button type="submit" class="btn btn-primary" id="btn-save-profile">Save Credentials</button>
              </div>
            </form>
          </div>
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

          state.activeStudent = { ...state.activeStudent, ...updates, ...updated };
          if (state.user) {
            state.user.name = updates.name;
            state.user.email = updates.email;
          }
          updateUserDisplay();
          showBanner('success', `Profile saved successfully.`);
          loadProfileView();
        } catch (err) {
          showBanner('error', `Failed to save profile: ${err.message}`);
          if (saveBtn) saveBtn.disabled = false;
        }
      });
    }
  }

  // 4. Faculty View: Placement Reports
  async function loadReportsView() {
    elements.mainContent.innerHTML = `
      <div class="card">
        <p class="text-muted" style="padding: 1.5rem; text-align: center;">Aggregating campus placement statistics...</p>
      </div>
    `;

    try {
      const data = await apiFetch('/api/v1/ui/reports/placement-performance');
      const perf = data.placement_performance || {};
      const totals = perf.totals || {};
      const packageStats = perf.package_stats || {};
      const branchStats = perf.branch_stats || [];
      const driveStats = perf.drive_stats || [];

      let html = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Placement Performance Report</h1>
            <p class="page-subtitle">Aggregate placement statistics and branch conversion rates across all drives.</p>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Total Applications</span>
            <span class="metric-value">${totals.total_applications || 0}</span>
            <span class="metric-meta">Across all drives</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Selected Students</span>
            <span class="metric-value" style="color: var(--status-emerald-text);">${totals.total_selected || 0}</span>
            <span class="metric-meta positive">Verified selections</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Offers Extended</span>
            <span class="metric-value" style="color: var(--primary);">${totals.total_offers || 0}</span>
            <span class="metric-meta">Pending candidate response</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Average Annual Package</span>
            <span class="metric-value">${formatCurrency(packageStats.average || 0)}</span>
            <span class="metric-meta">Highest: ${formatCurrency(packageStats.max || 0)}</span>
          </div>
        </div>

        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h3 class="card-title">Department Conversion Rates</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-container" style="border: none; box-shadow: none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Applications</th>
                    <th>Selected</th>
                    <th>Conversion Rate</th>
                    <th>Placement Status</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (branchStats.length === 0) {
        html += `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No departmental data recorded yet.</td></tr>`;
      } else {
        branchStats.forEach(b => {
          html += `
            <tr>
              <td><strong>${b.branch}</strong></td>
              <td>${b.applications}</td>
              <td style="color: var(--status-emerald-text); font-weight: 600;">${b.selected}</td>
              <td style="font-weight: 700;">${b.conversion_rate}%</td>
              <td>
                <span class="chip ${b.conversion_rate > 50 ? 'chip-selected' : 'chip-applied'}">
                  ${b.conversion_rate > 50 ? 'High Performing' : 'Standard'}
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
            <h3 class="card-title">Recruitment Drive Performance Breakdown</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-container" style="border: none; box-shadow: none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Drive Title</th>
                    <th>Status</th>
                    <th>Total Openings</th>
                    <th>Remaining</th>
                    <th>Applications</th>
                    <th>Selected</th>
                    <th>Package (INR)</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (driveStats.length === 0) {
        html += `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No drives logged.</td></tr>`;
      } else {
        driveStats.forEach(d => {
          html += `
            <tr>
              <td><strong>${d.title}</strong></td>
              <td><span class="chip ${d.state === 'OPEN' ? 'chip-selected' : 'chip-withdrawn'}">${d.state === 'OPEN' ? 'Open' : 'Closed'}</span></td>
              <td>${d.seats_total || d.seats_remaining}</td>
              <td>${d.seats_remaining}</td>
              <td>${d.applications}</td>
              <td style="color: var(--status-emerald-text); font-weight: 600;">${d.selected}</td>
              <td>${formatCurrency(d.package)}</td>
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

  // 5. Faculty View: Student Overview / Directory
  async function loadCohortView() {
    elements.mainContent.innerHTML = `
      <div class="card">
        <p class="text-muted" style="padding: 1.5rem; text-align: center;">Loading student cohort data...</p>
      </div>
    `;

    try {
      const data = await apiFetch('/api/v1/ui/reports/placement-performance');
      const cohort = data.cohort_analytics || {};
      const branchDist = cohort.branch_distribution || {};
      const topSkills = cohort.top_skills || [];

      let html = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Student Directory &amp; Cohort Overview</h1>
            <p class="page-subtitle">Track registered student distribution and prevailing skill sets across departments.</p>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Registered Students</span>
            <span class="metric-value">${cohort.total_registered || 0}</span>
            <span class="metric-meta">Verified active profiles</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Academic Departments</span>
            <span class="metric-value">${Object.keys(branchDist).length}</span>
            <span class="metric-meta">CSE, IT, ENTC, etc.</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Technical Skills Tracked</span>
            <span class="metric-value">${topSkills.length}</span>
            <span class="metric-meta">Candidate proficiencies</span>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Cohort Skill Distribution</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-container" style="border: none; box-shadow: none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Candidates Proficient</th>
                    <th>Prevalence</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (topSkills.length === 0) {
        html += `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">No skills data recorded.</td></tr>`;
      } else {
        const total = cohort.total_registered || 1;
        topSkills.forEach(s => {
          const pct = Math.round((s.count / total) * 100);
          html += `
            <tr>
              <td><strong>${s.skill}</strong></td>
              <td>${s.count} candidates</td>
              <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 600;">${pct}%</span>
                  <div style="flex: 1; max-width: 120px; height: 6px; background-color: var(--bg-surface-subtle); border-radius: var(--radius-full); overflow: hidden;">
                    <div style="width: ${pct}%; height: 100%; background-color: var(--primary);"></div>
                  </div>
                </div>
              </td>
              <td><span class="chip chip-evaluated">Core Skill</span></td>
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
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load student overview: ${err.message}</div>`;
    }
  }

  // 6. Admin & Faculty: Company Directory
  async function loadCompaniesView() {
    elements.mainContent.innerHTML = `
      <div class="card">
        <p class="text-muted" style="padding: 1.5rem; text-align: center;">Loading corporate partner directory...</p>
      </div>
    `;

    try {
      const companies = await apiFetch('/api/v1/ui/companies') || [];
      let html = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Company Directory</h1>
            <p class="page-subtitle">Corporate recruitment partners registered for on-campus and virtual hiring drives.</p>
          </div>
          <div class="page-actions">
            <button type="button" id="btn-open-create-company" class="btn btn-primary">+ Add Company</button>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Industry Sector</th>
                <th>Category Tier</th>
                <th>Contact Email</th>
                <th>Careers Portal</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (companies.length === 0) {
        html += `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No recruiter companies registered yet. Click [+ Add Company] to register one.</td></tr>`;
      } else {
        companies.forEach(c => {
          let tierChip = 'chip-applied';
          if (c.tier === 'Tier 1' || c.tier === 'TIER_1') tierChip = 'chip-selected';
          else if (c.tier === 'Tier 2' || c.tier === 'TIER_2') tierChip = 'chip-screening';
          else if (c.tier === 'Dream') tierChip = 'chip-tier';

          html += `
            <tr>
              <td>
                <strong>${c.name}</strong>
              </td>
              <td>${c.industry || 'Technology'}</td>
              <td><span class="chip ${tierChip}">${c.tier || 'Standard'}</span></td>
              <td style="color: var(--text-secondary);">${c.contact_email || '-'}</td>
              <td>
                ${c.website ? `<a href="${c.website}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); font-weight: 500; text-decoration: underline;">Visit Website</a>` : '-'}
              </td>
              <td><span class="chip chip-selected">Active Partner</span></td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>
        </div>
      `;

      elements.mainContent.innerHTML = html;

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

  // 7. Admin View: Operations Dashboard
  async function loadDashboardView(silent = false) {
    if (!silent) {
      elements.mainContent.innerHTML = `
        <div class="card">
          <p class="text-muted" style="padding: 1.5rem; text-align: center;">Loading live placement operations dashboard...</p>
        </div>
      `;
    }

    try {
      const [data, lockData] = await Promise.all([
        apiFetch('/api/v1/ui/dashboard'),
        apiFetch('/api/v1/ui/locks').catch(() => ({ active_locks_count: 0, active_locks: [] })),
      ]);
      state.dashboard = data;
      const metrics = data.metrics || {};
      const q = data.queue_metrics || {};
      const audit = data.recent_audit || [];

      let html = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Placement Operations Dashboard</h1>
            <p class="page-subtitle">Real-time status of placement drives, applications, interview slots, and system health.</p>
          </div>
          <div class="page-actions">
            <a href="#/admin/drives" class="btn btn-primary btn-sm">+ Manage Drives</a>
            <a href="#/admin/rankings" class="btn btn-outline btn-sm">Candidate Rankings</a>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Active Drives</span>
            <span class="metric-value" style="color: var(--primary);">${metrics.active_drives || 0}</span>
            <span class="metric-meta">Out of ${metrics.total_drives || 0} total drives</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Total Applications</span>
            <span class="metric-value">${metrics.total_applications || 0}</span>
            <span class="metric-meta">Submitted by students</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Open Positions</span>
            <span class="metric-value" style="color: var(--status-emerald-text);">${metrics.seats_available || 0}</span>
            <span class="metric-meta">Available recruitment seats</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">In Review Queue</span>
            <span class="metric-value" style="color: var(--status-amber-text);">${q.queue_depth || metrics.queue_depth || 0}</span>
            <span class="metric-meta">Pending screening</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Scheduled Interviews</span>
            <span class="metric-value" style="color: #0284c7;">${lockData.active_locks_count || 0}</span>
            <span class="metric-meta">Interview slots reserved</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Offers Issued</span>
            <span class="metric-value" style="color: #7c3aed;">${metrics.offers_issued || 0}</span>
            <span class="metric-meta">Awaiting student response</span>
          </div>
        </div>

        <!-- System Health Notification Card -->
        <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #ffffff, #f8fafc);">
          <div class="card-header">
            <h3 class="card-title">System Status &amp; Real-Time Synchronization</h3>
            <span class="chip chip-selected">All Systems Healthy</span>
          </div>
          <div class="card-body">
            <p style="font-size: 0.85rem; color: var(--text-secondary);">
              Placement microservices are synchronizing data continuously. Audit transactions and live events are streamed via Server-Sent Events with atomic consistency.
            </p>
          </div>
        </div>

        <!-- Recent Activity Feed -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Activity Feed</h3>
            <a href="#/admin/audit" class="btn btn-outline btn-sm">View Full Log</a>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-container" style="border: none; box-shadow: none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (audit.length === 0) {
        html += `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">No recent events recorded.</td></tr>`;
      } else {
        audit.slice(0, 8).forEach(item => {
          html += `
            <tr>
              <td><span class="chip chip-screening">${item.action || 'Activity'}</span></td>
              <td><strong>${item.table_name || item.tableName || '-'}</strong></td>
              <td>${item.actor || 'System'}</td>
              <td style="font-size: 0.78rem; color: var(--text-muted);">${new Date(item.timestamp || Date.now()).toLocaleTimeString()}</td>
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
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load operations dashboard: ${err.message}</div>`;
    }
  }

  // 8. Admin View: Manage Placement Drives
  async function loadDriveManagementView() {
    elements.mainContent.innerHTML = `
      <div class="card">
        <p class="text-muted" style="padding: 1.5rem; text-align: center;">Loading recruitment drives &amp; applicant pipelines...</p>
      </div>
    `;

    try {
      const [drives, allApps, companies] = await Promise.all([
        apiFetch('/api/v1/ui/drives'),
        apiFetch('/api/v1/ui/applications'),
        apiFetch('/api/v1/ui/companies').catch(() => []),
      ]);
      state.drives = drives || [];
      state.companies = companies || [];

      let html = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Manage Placement Drives</h1>
            <p class="page-subtitle">Publish recruitment drives, review candidate stages, and advance candidates through interview rounds.</p>
          </div>
          <div class="page-actions">
            <button type="button" id="btn-create-drive-trigger" class="btn btn-primary">+ Create Placement Drive</button>
          </div>
        </div>

        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h3 class="card-title">Placement Drives (${state.drives.length})</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-container" style="border: none; box-shadow: none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Drive Title</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Openings</th>
                    <th>Min CGPA</th>
                    <th>Annual Package</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (state.drives.length === 0) {
        html += `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No placement drives created yet. Click [+ Create Placement Drive] to begin.</td></tr>`;
      } else {
        state.drives.forEach(d => {
          const crit = d.criteria || {};
          const stateLabel = d.state === 'OPEN' ? 'Open' : (d.state === 'SCREENING' ? 'Screening' : (d.state === 'DRAFT' ? 'Draft' : 'Closed'));
          const stateChip = d.state === 'OPEN' ? 'chip-selected' : (d.state === 'SCREENING' ? 'chip-screening' : 'chip-withdrawn');

          html += `
            <tr>
              <td><strong>${d.title}</strong></td>
              <td>${d.company_name || d.company_id}</td>
              <td><span class="chip ${stateChip}">${stateLabel}</span></td>
              <td style="font-weight: 600;">${d.seats} seats</td>
              <td>${crit.min_cgpa !== undefined ? crit.min_cgpa : '-'}</td>
              <td style="font-weight: 600; color: var(--primary);">${formatCurrency(d.package)}</td>
              <td>
                <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                  <button type="button" class="btn btn-outline btn-sm btn-edit-drive" data-id="${d.drive_id}">Edit</button>
                  ${d.state === 'DRAFT' ? `<button type="button" class="btn btn-primary btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="OPEN">Open Drive</button>` : ''}
                  ${d.state === 'OPEN' ? `
                    <button type="button" class="btn btn-outline btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="SCREENING">Start Screening</button>
                    <button type="button" class="btn btn-outline btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="CLOSED" style="color: var(--status-rose-text);">Close</button>
                  ` : ''}
                  ${d.state === 'SCREENING' ? `
                    <button type="button" class="btn btn-outline btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="CLOSED" style="color: var(--status-rose-text);">Close</button>
                  ` : ''}
                  ${d.state === 'CLOSED' ? `
                    <button type="button" class="btn btn-outline btn-sm btn-drive-state" data-id="${d.drive_id}" data-state="OPEN">Reopen</button>
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

        <!-- Candidate Pipeline -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Candidate Pipeline Management (${(allApps || []).length} applicants)</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-container" style="border: none; box-shadow: none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Drive</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (!allApps || allApps.length === 0) {
        html += `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No candidate applications received yet.</td></tr>`;
      } else {
        allApps.forEach(app => {
          let actionButtons = '';
          if (app.state === 'SHORTLISTED') {
            actionButtons = `<button type="button" class="btn btn-primary btn-sm btn-schedule-trigger" data-app-id="${app.application_id}" data-student-id="${app.student_id}" data-student-name="${app.student_name || app.student_id}" data-drive-title="${app.drive_title || app.drive_id}">Schedule Interview</button>`;
          } else if (app.state === 'INTERVIEW_SCHEDULED') {
            actionButtons = `<button type="button" class="btn btn-primary btn-sm btn-select-candidate" data-app-id="${app.application_id}" data-version="${app.version}">Mark as Selected</button>`;
          } else if (app.state === 'SELECTED') {
            actionButtons = `
              <div style="display: flex; gap: 0.35rem;">
                <button type="button" class="btn btn-primary btn-sm btn-issue-offer" data-app-id="${app.application_id}" data-version="${app.version}">Send Offer</button>
                <button type="button" class="btn btn-outline btn-sm btn-compensate-candidate" data-app-id="${app.application_id}">Rollback</button>
              </div>
            `;
          } else if (app.state === 'OFFER_ISSUED') {
            actionButtons = `
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <span class="chip chip-offered">Offer Sent</span>
                <button type="button" class="btn btn-outline btn-sm btn-compensate-candidate" data-app-id="${app.application_id}" style="color: var(--status-rose-text);">Revoke</button>
              </div>
            `;
          } else if (app.state === 'COMPENSATION_REQUIRED') {
            actionButtons = `<span class="chip chip-not-eligible">Review Required</span>`;
          } else {
            actionButtons = `<span class="chip ${getStateChipClass(app.state)}">${getStateLabel(app.state)}</span>`;
          }

          html += `
            <tr>
              <td><strong>${app.student_name || app.student_id}</strong></td>
              <td>${app.drive_title || app.drive_id}</td>
              <td>${app.branch || '-'}</td>
              <td><span class="chip ${getStateChipClass(app.state)}">${getStateLabel(app.state)}</span></td>
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

      // Edit Drive Buttons
      elements.mainContent.querySelectorAll('.btn-edit-drive').forEach(btn => {
        btn.addEventListener('click', () => {
          const driveId = btn.getAttribute('data-id');
          openEditDriveModal(driveId);
        });
      });

      // Drive State Change Buttons
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
            showBanner('success', `Drive status updated successfully.`);
            loadDriveManagementView();
          } catch (err) {
            showBanner('error', `Failed to update drive: ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Create Drive Trigger
      const createDriveBtn = document.getElementById('btn-create-drive-trigger');
      if (createDriveBtn) {
        createDriveBtn.addEventListener('click', () => {
          if (elements.newDriveCompanySelect) {
            elements.newDriveCompanySelect.innerHTML = state.companies.map(c => `<option value="${c.company_id}">${c.name} (${c.tier})</option>`).join('');
          }
          if (elements.driveModalError) elements.driveModalError.classList.add('hidden');
          if (elements.createDriveModal) elements.createDriveModal.classList.remove('hidden');
        });
      }

      // Schedule Interview Trigger
      elements.mainContent.querySelectorAll('.btn-schedule-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
          const appId = btn.getAttribute('data-app-id');
          const studentId = btn.getAttribute('data-student-id');
          const studentName = btn.getAttribute('data-student-name');
          const driveTitle = btn.getAttribute('data-drive-title');

          if (elements.scheduleAppId) elements.scheduleAppId.value = appId;
          if (elements.scheduleStudentId) elements.scheduleStudentId.value = studentId;
          if (elements.scheduleStudentName) elements.scheduleStudentName.textContent = studentName;
          if (elements.scheduleDriveTitle) elements.scheduleDriveTitle.textContent = driveTitle;

          if (elements.scheduleModalError) elements.scheduleModalError.classList.add('hidden');
          if (elements.scheduleModal) elements.scheduleModal.classList.remove('hidden');
        });
      });

      // Mark as Selected Button
      elements.mainContent.querySelectorAll('.btn-select-candidate').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-app-id');
          const version = Number(btn.getAttribute('data-version') || 1);
          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/offers/commit', {
              method: 'POST',
              body: JSON.stringify({
                application_id: appId,
                target_state: 'SELECTED',
                expected_version: version,
              }),
            });
            showBanner('success', `Candidate marked as selected!`);
            loadDriveManagementView();
          } catch (err) {
            showBanner('error', `Failed to select candidate: ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Send Offer Button
      elements.mainContent.querySelectorAll('.btn-issue-offer').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-app-id');
          const version = Number(btn.getAttribute('data-version') || 1);
          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/offers/commit', {
              method: 'POST',
              body: JSON.stringify({
                application_id: appId,
                target_state: 'OFFER_ISSUED',
                expected_version: version,
              }),
            });
            showBanner('success', `Offer sent to candidate. Awaiting their response.`);
            loadDriveManagementView();
          } catch (err) {
            showBanner('error', `Failed to issue offer: ${err.message}`);
            btn.disabled = false;
          }
        });
      });

      // Compensate / Rollback Button
      elements.mainContent.querySelectorAll('.btn-compensate-candidate').forEach(btn => {
        btn.addEventListener('click', async () => {
          const appId = btn.getAttribute('data-app-id');
          const reason = prompt('Please enter a reason for this rollback:', 'Administrative review');
          if (!reason) return;

          btn.disabled = true;
          try {
            await apiFetch('/api/v1/ui/offers/compensate', {
              method: 'POST',
              body: JSON.stringify({
                application_id: appId,
                reason,
              }),
            });
            showBanner('info', `Action reversed. Application has been rolled back.`);
            loadDriveManagementView();
          } catch (err) {
            showBanner('error', `Failed to rollback candidate: ${err.message}`);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load drives: ${err.message}</div>`;
    }
  }

  // 9. Admin View: Candidate Ranking Engine
  async function loadRankingEngineView() {
    elements.mainContent.innerHTML = `
      <div class="card">
        <p class="text-muted" style="padding: 1.5rem; text-align: center;">Initializing candidate ranking engine...</p>
      </div>
    `;

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
      <div class="page-header">
        <div>
          <h1 class="page-title">Candidate Rankings &amp; Shortlisting</h1>
          <p class="page-subtitle">Rank applicants objectively based on academic merit and skill profile match.</p>
        </div>
        <div class="page-actions">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <label for="ranking-drive-select" style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Select Drive:</label>
            <select id="ranking-drive-select" class="form-select" style="min-width: 220px;">
              ${state.drives.map(d => `<option value="${d.drive_id}" ${d.drive_id === activeDriveId ? 'selected' : ''}>${d.title}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Algorithm and Batch Shortlist Card -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 class="card-title">Scoring Strategy</h3>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">Select the prioritization model for candidate ranking</p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <label for="topk-count" style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Shortlist Top:</label>
            <input type="number" id="topk-count" class="form-input" min="1" max="50" value="3" style="width: 70px; height: 34px;" />
            <button type="button" id="btn-commit-topk" class="btn btn-primary btn-sm">Batch Shortlist</button>
          </div>
        </div>

        <div class="card-body">
          <div class="filter-group" style="margin-bottom: 1rem;">
            <button type="button" class="filter-pill algo-btn ${state.selectedAlgo === 'WEIGHTED_SCORE' ? 'active' : ''}" data-algo="WEIGHTED_SCORE">
              Weighted Merit Score
            </button>
            <button type="button" class="filter-pill algo-btn ${state.selectedAlgo === 'HEAP_TOPK' ? 'active' : ''}" data-algo="HEAP_TOPK">
              Top Percentile Heap
            </button>
            <button type="button" class="filter-pill algo-btn ${state.selectedAlgo === 'MERGE_SORT' ? 'active' : ''}" data-algo="MERGE_SORT">
              Deterministic Sort
            </button>
          </div>

          <div style="background-color: var(--bg-surface-subtle); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.825rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
            ${state.selectedAlgo === 'WEIGHTED_SCORE' ? 'Evaluates applicants by combining normalized CGPA (60%) with verified technical skill overlap (40%).' : ''}
            ${state.selectedAlgo === 'HEAP_TOPK' ? 'Extracts the highest-performing applicants instantaneously using a priority heap.' : ''}
            ${state.selectedAlgo === 'MERGE_SORT' ? 'Applies stable ordering by score with secondary tie-breaking by candidate registration date.' : ''}
          </div>

          <div class="table-container" style="border: none; box-shadow: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Candidate Name</th>
                  <th>Department</th>
                  <th>CGPA</th>
                  <th>Skills Profile</th>
                  <th>Total Score</th>
                </tr>
              </thead>
              <tbody>
    `;

    if (rankings.length === 0) {
      html += `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No candidates scored for this drive yet.</td></tr>`;
    } else {
      rankings.forEach(r => {
        const skillsList = Array.isArray(r.skills) ? r.skills.join(', ') : '-';
        html += `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">#${r.rank}</td>
            <td><strong>${r.name || r.student_id}</strong></td>
            <td>${r.branch || '-'}</td>
            <td>${r.cgpa || '-'}</td>
            <td style="font-size: 0.75rem; color: var(--text-secondary);">${skillsList}</td>
            <td style="font-weight: 700; color: var(--status-emerald-text); font-size: 0.95rem;">${r.total_score}</td>
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
          showBanner('success', `${res.length} candidate(s) shortlisted successfully.`);
        } catch (err) {
          showBanner('error', `Shortlist Failed: ${err.message}`);
        } finally {
          commitTopkBtn.disabled = false;
        }
      });
    }
  }

  // 10. Admin View: User Management
  async function loadUserAccountsView() {
    elements.mainContent.innerHTML = `
      <div class="card">
        <p class="text-muted" style="padding: 1.5rem; text-align: center;">Loading registered accounts...</p>
      </div>
    `;

    try {
      const users = await apiFetch('/api/v1/auth/users');
      let html = `
        <div class="page-header">
          <div>
            <h1 class="page-title">User Account Management</h1>
            <p class="page-subtitle">Inspect registered students, faculty members, and administrative staff accounts.</p>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Access Role</th>
                <th>Student ID</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (users.length === 0) {
        html += `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No user accounts found.</td></tr>`;
      } else {
        users.forEach(u => {
          let roleChip = 'chip-applied';
          if (u.role === 'admin') roleChip = 'chip-withdrawn';
          else if (u.role === 'faculty') roleChip = 'chip-screening';

          html += `
            <tr>
              <td><strong>${u.username}</strong></td>
              <td>${u.name}</td>
              <td style="color: var(--text-secondary);">${u.email}</td>
              <td><span class="chip ${roleChip}">${u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span></td>
              <td>${u.student_id || '-'}</td>
              <td style="font-size: 0.78rem; color: var(--text-muted);">${new Date(u.created_at || Date.now()).toLocaleDateString()}</td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>
        </div>
      `;

      elements.mainContent.innerHTML = html;
    } catch (err) {
      elements.mainContent.innerHTML = `<div class="banner error">Failed to load user accounts: ${err.message}</div>`;
    }
  }

  // 11. Admin View: Activity Audit Trail
  async function loadAuditTrailView(filters = {}) {
    elements.mainContent.innerHTML = `
      <div class="card">
        <p class="text-muted" style="padding: 1.5rem; text-align: center;">Loading activity log records...</p>
      </div>
    `;

    try {
      const qs = new URLSearchParams();
      if (filters.actor) qs.append('actor', filters.actor);
      if (filters.action) qs.append('action', filters.action);
      if (filters.table_name) qs.append('table_name', filters.table_name);
      if (filters.record_id) qs.append('record_id', filters.record_id);
      qs.append('limit', '50');

      const audit = await apiFetch(`/api/v1/ui/audit?${qs.toString()}`) || [];

      let html = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Activity Audit Trail</h1>
            <p class="page-subtitle">Immutable log of all state transitions, application filings, and offers.</p>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-body">
            <form id="audit-filter-form" style="display: flex; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap;">
              <div class="form-group" style="margin: 0; min-width: 140px;">
                <label for="filter-actor" class="form-label" style="font-size: 0.75rem;">Actor</label>
                <input type="text" id="filter-actor" class="form-input" placeholder="e.g. admin or alice" value="${filters.actor || ''}" />
              </div>
              <div class="form-group" style="margin: 0; min-width: 160px;">
                <label for="filter-action" class="form-label" style="font-size: 0.75rem;">Event Type</label>
                <select id="filter-action" class="form-select">
                  <option value="">All Events</option>
                  <option value="COMMIT_OFFER" ${filters.action === 'COMMIT_OFFER' ? 'selected' : ''}>Offer Sent</option>
                  <option value="CREATE_APPLICATION" ${filters.action === 'CREATE_APPLICATION' ? 'selected' : ''}>Application Created</option>
                  <option value="OFFER_ACCEPTED" ${filters.action === 'OFFER_ACCEPTED' ? 'selected' : ''}>Offer Accepted</option>
                  <option value="OFFER_DECLINED" ${filters.action === 'OFFER_DECLINED' ? 'selected' : ''}>Offer Declined</option>
                  <option value="WITHDRAW" ${filters.action === 'WITHDRAW' ? 'selected' : ''}>Application Withdrawn</option>
                  <option value="REGISTER_USER" ${filters.action === 'REGISTER_USER' ? 'selected' : ''}>User Registered</option>
                </select>
              </div>
              <div class="form-group" style="margin: 0; min-width: 150px;">
                <label for="filter-table" class="form-label" style="font-size: 0.75rem;">Entity Category</label>
                <select id="filter-table" class="form-select">
                  <option value="">All</option>
                  <option value="applications" ${filters.table_name === 'applications' ? 'selected' : ''}>Applications</option>
                  <option value="drives" ${filters.table_name === 'drives' ? 'selected' : ''}>Drives</option>
                  <option value="companies" ${filters.table_name === 'companies' ? 'selected' : ''}>Companies</option>
                  <option value="offers" ${filters.table_name === 'offers' ? 'selected' : ''}>Offers</option>
                  <option value="students" ${filters.table_name === 'students' ? 'selected' : ''}>Students</option>
                  <option value="users" ${filters.table_name === 'users' ? 'selected' : ''}>Users</option>
                </select>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="submit" class="btn btn-primary btn-sm">Filter</button>
                <button type="button" id="btn-reset-audit" class="btn btn-outline btn-sm">Clear</button>
              </div>
            </form>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Event Action</th>
                <th>Target Entity</th>
                <th>Actor</th>
                <th>Record ID</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (audit.length === 0) {
        html += `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No activity records found matching filters.</td></tr>`;
      } else {
        audit.forEach(item => {
          const actionLabel = {
            COMMIT_OFFER: 'Offer Sent',
            CREATE_APPLICATION: 'Application Created',
            OFFER_ACCEPTED: 'Offer Accepted',
            OFFER_DECLINED: 'Offer Declined',
            WITHDRAW: 'Application Withdrawn',
            REGISTER_USER: 'User Registered',
          }[item.action] || item.action || 'Activity';

          html += `
            <tr>
              <td><span class="chip chip-screening">${actionLabel}</span></td>
              <td><strong>${item.table_name || item.tableName || '-'}</strong></td>
              <td>${item.actor || 'System'}</td>
              <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">${(item.record_id || item.recordId || '-').slice(0, 16)}</td>
              <td style="font-size: 0.78rem; color: var(--text-secondary);">${new Date(item.timestamp || Date.now()).toLocaleString()}</td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>
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

  // =========================================================================
  // MODAL ACTIONS & FORM HANDLERS
  // =========================================================================

  function openApplyModal(driveId) {
    if (!state.user || state.role !== 'student' || !state.activeStudent) {
      showBanner('warning', 'Please sign in with a registered student account to apply.');
      openAuthModal('login');
      return;
    }

    const drive = state.drives.find(d => d.drive_id === driveId);
    if (!drive) return;

    elements.applyDriveId.value = drive.drive_id;
    elements.modalDriveTitle.textContent = `Apply to ${drive.title}`;
    elements.modalCompanyDisplay.textContent = `${drive.company_name || 'Recruiter'} — ${formatCurrency(drive.package)}`;
    elements.modalStudentDisplay.textContent = `${state.activeStudent.name}`;
    elements.modalMetricsDisplay.textContent = `${state.activeStudent.branch} | CGPA: ${state.activeStudent.cgpa} | Backlogs: ${state.activeStudent.backlogs}`;
    elements.applyConsent.checked = false;

    elements.applyModalProgress.classList.add('hidden');
    elements.modalApplySubmit.disabled = false;
    elements.applyModal.classList.remove('hidden');
  }

  function closeApplyModal() {
    if (elements.applyModal) elements.applyModal.classList.add('hidden');
  }

  async function handleApplySubmit(e) {
    e.preventDefault();
    if (!elements.applyConsent.checked) {
      alert('Please confirm applicant consent before submitting.');
      return;
    }

    const driveId = elements.applyDriveId.value;
    const resumeVersion = elements.resumeVersion.value;

    elements.modalApplySubmit.disabled = true;
    elements.applyModalProgress.classList.remove('hidden');
    elements.applyProgressText.textContent = 'Submitting your application...';

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

      const rank = response?.ranking?.rank || 1;
      showBanner('success', `Application submitted successfully! You've been ranked #${rank}.`);

      window.location.hash = '#/student/applications';
    } catch (err) {
      elements.applyModalProgress.classList.add('hidden');
      elements.modalApplySubmit.disabled = false;
      showBanner('error', `Failed to submit application: ${err.message}`);
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
    if (elements.driveEditModal) elements.driveEditModal.classList.add('hidden');
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
      showBanner('success', `Drive updated successfully.`);
      loadDriveManagementView();
    } catch (err) {
      showBanner('error', `Failed to update drive: ${err.message}`);
    }
  }

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
      showBanner('success', `${payload.name} added successfully.`);
      const currentHash = getCurrentHash();
      if (currentHash === '#/admin/companies' || currentHash === '#/faculty/companies') {
        loadCompaniesView();
      } else {
        loadDriveManagementView();
      }
    } catch (err) {
      if (elements.companyModalError) {
        elements.companyModalError.textContent = err.message;
        elements.companyModalError.classList.remove('hidden');
      } else {
        showBanner('error', `Failed to add company: ${err.message}`);
      }
    }
  }

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
      showBanner('success', `Drive "${payload.title}" created successfully.`);
      state.drives = [];
      loadDriveManagementView();
    } catch (err) {
      if (elements.driveModalError) {
        elements.driveModalError.textContent = err.message;
        elements.driveModalError.classList.remove('hidden');
      } else {
        showBanner('error', `Failed to create drive: ${err.message}`);
      }
    }
  }

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
      showBanner('success', `Interview scheduled successfully.`);
      loadDriveManagementView();
    } catch (err) {
      if (elements.scheduleModalError) {
        elements.scheduleModalError.textContent = err.message;
        elements.scheduleModalError.classList.remove('hidden');
      } else {
        showBanner('error', `Failed to schedule interview: ${err.message}`);
      }
    }
  }

  // ── Global Event Bindings ───────────────────────────────────────────────────
  function setupEventListeners() {
    // Hash change router listener
    window.addEventListener('hashchange', () => handleRoute(false));

    // Mobile sidebar drawer toggle
    if (elements.mobileSidebarToggle) {
      elements.mobileSidebarToggle.addEventListener('click', () => {
        elements.sidebar?.classList.toggle('open');
      });
    }

    // Auth header controls
    if (elements.authBtn) elements.authBtn.addEventListener('click', () => openAuthModal('login'));
    if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', handleLogout);
    if (elements.sidebarLogoutBtn) elements.sidebarLogoutBtn.addEventListener('click', handleLogout);

    // Auth modal controls
    if (elements.modalAuthClose) elements.modalAuthClose.addEventListener('click', closeAuthModal);
    if (elements.tabAuthLogin) elements.tabAuthLogin.addEventListener('click', () => switchAuthTab('login'));
    if (elements.tabAuthRegister) elements.tabAuthRegister.addEventListener('click', () => switchAuthTab('register'));
    if (elements.loginForm) elements.loginForm.addEventListener('submit', handleLogin);
    if (elements.registerForm) elements.registerForm.addEventListener('submit', handleRegister);
    if (elements.regRole) {
      elements.regRole.addEventListener('change', (e) => {
        if (e.target.value === 'faculty') {
          elements.studentRegFields?.classList.add('hidden');
        } else {
          elements.studentRegFields?.classList.remove('hidden');
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
    if (elements.bannerClose) elements.bannerClose.addEventListener('click', hideBanner);

    // Apply Modal
    if (elements.modalApplyClose) elements.modalApplyClose.addEventListener('click', closeApplyModal);
    if (elements.modalApplyCancel) elements.modalApplyCancel.addEventListener('click', closeApplyModal);
    if (elements.applyForm) elements.applyForm.addEventListener('submit', handleApplySubmit);

    // Edit Drive Modal
    if (elements.modalEditClose) elements.modalEditClose.addEventListener('click', closeEditDriveModal);
    if (elements.modalEditCancel) elements.modalEditCancel.addEventListener('click', closeEditDriveModal);
    if (elements.driveEditForm) elements.driveEditForm.addEventListener('submit', handleEditDriveSubmit);

    // Create Company Modal
    if (elements.modalCreateCompanyClose) elements.modalCreateCompanyClose.addEventListener('click', () => elements.createCompanyModal.classList.add('hidden'));
    if (elements.modalCreateCompanyCancel) elements.modalCreateCompanyCancel.addEventListener('click', () => elements.createCompanyModal.classList.add('hidden'));
    if (elements.createCompanyForm) elements.createCompanyForm.addEventListener('submit', handleCreateCompanySubmit);

    // Create Drive Modal
    if (elements.modalCreateDriveClose) elements.modalCreateDriveClose.addEventListener('click', () => elements.createDriveModal.classList.add('hidden'));
    if (elements.modalCreateDriveCancel) elements.modalCreateDriveCancel.addEventListener('click', () => elements.createDriveModal.classList.add('hidden'));
    if (elements.createDriveForm) elements.createDriveForm.addEventListener('submit', handleCreateDriveSubmit);

    // Schedule Interview Modal
    if (elements.modalScheduleClose) elements.modalScheduleClose.addEventListener('click', () => elements.scheduleModal.classList.add('hidden'));
    if (elements.modalScheduleCancel) elements.modalScheduleCancel.addEventListener('click', () => elements.scheduleModal.classList.add('hidden'));
    if (elements.scheduleForm) elements.scheduleForm.addEventListener('submit', handleScheduleSubmit);
  }

  // ── Application Initialization ──────────────────────────────────────────────
  async function init() {
    setupEventListeners();
    await initSession();
    handleRoute(false);
    initSSE();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
