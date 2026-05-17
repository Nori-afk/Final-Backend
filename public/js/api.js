/* =============================================
   BVETTER — Centralized API Layer
   File: js/api.js
   Depends: nothing (load before all page JS)

   RULE: ALL fetch() calls live here ONLY.
   Never write fetch() directly in page JS files.

   HOW TO USE in any page JS:
     const data = await api.getReports({ status: 'lost' });

   HOW TO SWAP TO REAL BACKEND:
     1. Change API_BASE to your production URL
     2. On login success, save token:
        sessionStorage.setItem('bvetter_token', response.token)
     3. All other calls auto-attach the token via authHeaders()

   Functions:
   - authHeaders()          — builds Authorization header from token
   - api.login()            — POST /auth/login
   - api.logout()           — POST /auth/logout
   - api.register()         — POST /auth/register
   - api.forgotPassword()   — POST /auth/forgot-password
   - api.getReports()       — GET  /reports (with filters)
   - api.getReportById()    — GET  /reports/:id
   - api.getMyReports()     — GET  /reports/mine
   - api.getMatchesByReportId() — GET /reports/:id/matches
   - api.submitReport()     — POST /reports/lost or /reports/found
   - api.submitSighting()   — POST /sightings
   - api.getClaims()        — GET  /claims
   - api.submitClaim()      — POST /claims
   - api.resolveClaim()     — PATCH /claims/:id/resolve
   - api.getAppointments()  — GET  /appointments
   - api.bookAppointment()  — POST /appointments
   - api.getProfile()       — GET  /user/profile
   - api.updateProfile()    — PATCH /user/profile
   - api.changePassword()   — PATCH /user/password
   - api.getNotifPrefs()    — GET  /notifications/preferences
   - api.updateNotifPrefs() — PATCH /notifications/preferences
   ============================================= */

/* ── Base URL ─────────────────────────────────
   TODO: Change to production URL before deploy   */
const API_BASE = 'http://localhost/withbackend/BVETTER-MAIN/backend'; // DEV URL (XAMPP localhost)

/* ── Auth Header Builder ──────────────────────
   Reads JWT token saved on login.
   Backend must return { token: '...' } on login. */
function authHeaders() {
  const token = sessionStorage.getItem('bvetter_token');
  return token
    ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

/* ── Auth header for FormData (file uploads) ──
   Do NOT set Content-Type — browser sets it
   automatically with the correct boundary.       */
function authHeadersFormData() {
  const token = sessionStorage.getItem('bvetter_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

const api = {
  
  /* ══════════════════════════════════════════
     AUTH
     ══════════════════════════════════════════ */

  /**
   * Login user
   * TODO: On success → save response.token to sessionStorage
   * @param {string} email
   * @param {string} password
   */
  login: (email, password) =>
    fetch(`${API_BASE}/auth/login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
      
    }).then(r => r.json()),

  /**
   * Logout — invalidates token on server
   */
  logout: () =>
    fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: authHeaders()
    }).then(r => r.json()),

  /**
   * Register new account
   * @param {Object} data — { full_name, email, password, barangay }
   */
  register: (data) =>
    fetch(`${API_BASE}/auth/register.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),

  /**
   * Send password reset link
   * @param {string} email
   */
  forgotPassword: (email) =>
    fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }).then(r => r.json()),


  /* ══════════════════════════════════════════
     LOST & FOUND — REPORTS
     ══════════════════════════════════════════ */

  /**
   * Get all reports (with optional filters)
   * @param {Object} filters — { status, barangay, type, date }
   * Replaces: const petData = [...] in lost-found.js
   */
  getReports: (filters = {}) =>
    // combined lost + found list
    Promise.all([
      fetch(`${API_BASE}/lost_pet.php`).then(r => r.json()),
      fetch(`${API_BASE}/found_pet.php`).then(r => r.json())
    ]).then(([lostRes, foundRes]) => {
      const lost = (lostRes && lostRes.lost_list) ? lostRes.lost_list.map(r => ({ ...r, status: 'lost' })) : [];
      const found = (foundRes && foundRes.found_list) ? foundRes.found_list.map(r => ({ ...r, status: 'found' })) : [];
      return { success: true, reports: lost.concat(found) };
    }),

  /**
   * Get single report — used in lost-found-detail.html
   * @param {string} id — report ID from URL ?id=
   */
  getReportById: (id) =>
    // try lost then found
    fetch(`${API_BASE}/lost_pet.php?id=${id}`).then(r => r.json()).then(l => {
      if (l && l.success && l.lost) return { success: true, type: 'lost', report: l.lost };
      return fetch(`${API_BASE}/found_pet.php?id=${id}`).then(r => r.json()).then(f => ({ success: true, type: 'found', report: f.found }));
    }),

  /**
   * Get current user's own reports — My Reports tab
   */
  getMyReports: () =>
    Promise.all([
      fetch(`${API_BASE}/lost_pet.php`).then(r => r.json()),
      fetch(`${API_BASE}/found_pet.php`).then(r => r.json())
    ]).then(([lostRes, foundRes]) => {
      const lost = (lostRes && lostRes.lost_list) ? lostRes.lost_list.map(r => ({ ...r, status: 'lost' })) : [];
      const found = (foundRes && foundRes.found_list) ? foundRes.found_list.map(r => ({ ...r, status: 'found' })) : [];
      return { success: true, reports: lost.concat(found) };
    }),

  /**
   * Get Jaccard Similarity matches for a lost report
   * @param {string} reportId
   */
  getMatchesByReportId: (reportId) =>
    fetch(`${API_BASE}/reports/${reportId}/matches`, {
      headers: authHeaders()
    }).then(r => r.json()),

  /**
   * Submit lost or found report (includes photo upload)
   * @param {string} type — 'lost' | 'found'
   * @param {FormData} formData — use FormData, NOT JSON (photo upload)
   */
  submitReport: (type, formData) =>
    // convert FormData to JSON-compatible object if needed
    new Promise((resolve, reject) => {
      let obj = {};
      if (formData instanceof FormData) {
        for (const [k, v] of formData.entries()) obj[k] = v;
      } else if (typeof formData === 'object') {
        obj = formData;
      }
      const url = type === 'lost' ? `${API_BASE}/lost_pet.php` : `${API_BASE}/found_pet.php`;
      fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(obj)
      }).then(r => r.json()).then(resolve).catch(reject);
    }),


  /* ══════════════════════════════════════════
     SIGHTINGS
     ══════════════════════════════════════════ */

  /**
   * Submit a sighting report (optional photo)
   * @param {FormData} formData
   */
  submitSighting: (formData) =>
    // accepts FormData or object
    new Promise((resolve, reject) => {
      let obj = {};
      if (formData instanceof FormData) {
        for (const [k, v] of formData.entries()) obj[k] = v;
      } else if (typeof formData === 'object') obj = formData;
      fetch(`${API_BASE}/sighting.php`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(obj)
      }).then(r => r.json()).then(resolve).catch(reject);
    }),


  /* ══════════════════════════════════════════
     CLAIMS — My Claims page
     ══════════════════════════════════════════ */

  /**
   * Get all claims by current user — My Claims tab
   * Replaces: static rows in my-claims.html
   */
  getClaims: () =>
    fetch(`${API_BASE}/claim.php`, { headers: authHeaders() }).then(r => r.json()),

  /**
   * Submit ownership claim with proof documents
   * @param {string} reportId — which found-pet report to claim
   * @param {FormData} formData — includes proof files
   */
  submitClaim: (reportId, formData) => {
    // formData may be FormData or plain object
    let obj = {};
    if (formData instanceof FormData) {
      for (const [k, v] of formData.entries()) obj[k] = v;
    } else if (typeof formData === 'object') obj = formData;
    obj.report_id = reportId;
    return fetch(`${API_BASE}/claim.php`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(obj)
    }).then(r => r.json());
  },

  /**
   * Mark a claim as resolved (pet returned home)
   * @param {string} claimId
   */
  resolveClaim: (claimId) =>
    fetch(`${API_BASE}/claim.php?id=${claimId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ Claim_Status: 'approved' })
    }).then(r => r.json()),


  /* ══════════════════════════════════════════
     APPOINTMENTS
     ══════════════════════════════════════════ */

  /**
   * Get all appointments for current user
   * Replaces: static appt rows in book-appointment.html
   */
  getAppointments: () =>
    fetch(`${API_BASE}/appointment.php`, { headers: authHeaders() }).then(r => r.json()),

  /**
   * Book a new appointment
   * @param {Object} data — { owner, pet, visit_type, date, time, notes }
   */
  bookAppointment: (data) =>
    fetch(`${API_BASE}/appointment.php`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),


  /* ══════════════════════════════════════════
     USER / ACCOUNT
     ══════════════════════════════════════════ */

  /**
   * Get logged-in user profile
   * Replaces: hardcoded 'Mark Depa' everywhere
   */
  getProfile: () =>
    fetch(`${API_BASE}/user/profile`, {
      headers: authHeaders()
    }).then(r => r.json()),

  /**
   * Update profile info (name, email, phone)
   * @param {Object} data
   */
  updateProfile: (data) =>
    fetch(`${API_BASE}/user/profile`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),

  /**
   * Change password
   * @param {Object} data — { current_password, new_password }
   */
  changePassword: (data) =>
    fetch(`${API_BASE}/user/password`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),


  /* ══════════════════════════════════════════
     NOTIFICATIONS
     ══════════════════════════════════════════ */

  /**
   * Get notification preferences
   */
  getNotifPrefs: () =>
    fetch(`${API_BASE}/notifications/preferences`, {
      headers: authHeaders()
    }).then(r => r.json()),

  /**
   * Save notification preferences
   * @param {Object} data — { lost_found: { email, sms, app }, ... }
   */
  updateNotifPrefs: (data) =>
    fetch(`${API_BASE}/notifications/preferences`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),

  getBarangays: () =>
    fetch(`${API_BASE}/barangay.php`).then(r => r.json()),

};


