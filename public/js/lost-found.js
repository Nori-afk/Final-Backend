/* =============================================
   BVETTER — Lost & Found Page JS
   File: public/js/lost-found.js
   Depends: nav.js, api.js

   KEY RULES:
   - Public grid: read-only view details only
   - Matching suggestions: ONLY inside My Reports panel
     after user clicks their own report card
   - Claim flow: ONLY accessible from matches panel,
     not from public grid
   ============================================= */

/* ── Nav user menu ────────────────────────── */
function toggleUserMenu() {
  var dd = document.getElementById('userDropdown');
  if (dd) dd.classList.toggle('open');
}

document.addEventListener('click', function (e) {
  var pill = document.querySelector('.nav-user-pill');
  var dd   = document.getElementById('userDropdown');
  if (dd && !pill?.contains(e.target) && !dd.contains(e.target)) {
    dd.classList.remove('open');
  }
});

function logout() {
  if (window.VBetterAuth) window.VBetterAuth.logout();
  else window.location.href = 'login.html';
}

/* ── Filter Tabs ─────────────────────────── */
function filterPets(type, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  document.getElementById('petGridSection').style.display   = 'block';
  document.getElementById('myReportsSection').style.display = 'none';

  /* TODO backend: api.getReports({ status: type }).then(renderGrid) */
  document.querySelectorAll('.pet-card').forEach(card => {
    const status = card.getAttribute('data-status');
    card.classList.toggle('hidden', type !== 'all' && type !== status);
  });
}

function showMyReports(btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('petGridSection').style.display   = 'none';
  document.getElementById('myReportsSection').style.display = 'block';
  /* TODO backend: api.getMyReports().then(renderMyReports) */
}

/* ── Modal Helpers ───────────────────────── */
function openModalById(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOutside(event, id) {
  if (event.target === document.getElementById(id)) closeModal(id);
}

function closeAll() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}

/* ── Matches Panel ───────────────────────────
   Only opens when user clicks their OWN report card.
   reportKey = key to look up which report's matches to show.
─────────────────────────────────────────────── */
function openMyReportMatches(reportKey) {
  /* TODO backend:
     const matches = await api.getMatchesByReportId(reportKey);
     renderMatches(matches);
  */

  // Update panel title with pet name
  const nameMap = {
    cooper: 'Cooper',
    found1: 'Found Pet #1'
  };
  const nameEl = document.getElementById('matchesPetName');
  if (nameEl) nameEl.textContent = nameMap[reportKey] || reportKey;

  // Reveal panel
  const overlay = document.getElementById('matchesPanelOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Animate match bars in
  setTimeout(() => {
    document.querySelectorAll('.lf-match-bar').forEach(bar => {
      const target = bar.dataset.width + '%';
      bar.style.width = target;
    });
  }, 200);
}

function closeMatchesPanelDirect() {
  const overlay = document.getElementById('matchesPanelOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function closeMatchesPanel(event) {
  // Only close if clicking the dark overlay backdrop, not the panel itself
  if (event.target === document.getElementById('matchesPanelOverlay')) {
    closeMatchesPanelDirect();
  }
}

/* ── Match Actions ───────────────────────────
   These are ONLY available inside the matches panel
   on the user's own report — never on public grid.
─────────────────────────────────────────────── */
function handleNotMine(btn) {
  /* TODO backend: PATCH /api/reports/:id/dismiss-match/:matchId */
  const card = btn.closest('.lf-match-card');
  if (!card) return;

  card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
  card.style.opacity    = '0';
  card.style.transform  = 'translateX(-12px)';

  setTimeout(() => {
    card.remove();
    // Check if no match cards remain
    const remaining = document.querySelectorAll('#matchesPanel .lf-match-card');
    if (remaining.length === 0) {
      const empty = document.getElementById('noMatchesState');
      if (empty) empty.style.display = 'flex';

      // Update the report card badge
      const badge = document.querySelector('.match-alert-badge');
      if (badge) badge.style.display = 'none';
    }
  }, 380);
}

function handleClaim(btn) {
  /* Opens claim modal — user must have a matching report to reach here */
  openModalById('claimModal');
}

/* ── Report Modal (Lost / Found) ─────────── */
let currentReportType = 'lost';

function openModal(type) {
  currentReportType = type;

  const title           = document.getElementById('modalTitle');
  const submitText      = document.getElementById('submitText');
  const petNameRow      = document.getElementById('petNameRow');
  const incidentLabel   = document.getElementById('incidentLabel');
  const dateLostLabel   = document.getElementById('dateLostLabel');
  const notesLabel      = document.getElementById('notesLabel');
  const petDetailsLabel = document.getElementById('petDetailsLabel');

  if (type === 'lost') {
    title.textContent           = 'Report Lost Pet';
    submitText.textContent      = 'Submit Lost Pet Report';
    if (petNameRow)   petNameRow.style.display = 'block';
    petDetailsLabel.textContent = 'PET DETAILS';
    incidentLabel.textContent   = 'INCIDENT DETAILS';
    dateLostLabel.textContent   = 'Date Lost';
    notesLabel.textContent      = 'Additional Details';
  } else {
    title.textContent           = 'Report Found Pet';
    submitText.textContent      = 'Submit Found Pet Report';
    if (petNameRow)   petNameRow.style.display = 'none';
    petDetailsLabel.textContent = 'ANIMAL DETAILS';
    incidentLabel.textContent   = 'WHERE AND WHEN FOUND';
    dateLostLabel.textContent   = 'Date Found';
    notesLabel.textContent      = 'Current Status / Notes';
  }

  openModalById('reportModal');
}

function submitReport() {
  // collect form values from modal
  const obj = {};
  obj.user_ID = getCurrentUser() ? getCurrentUser().id : 1;
  obj.Date_lost = document.getElementById('reportDate')?.value || document.getElementById('reportDateFound')?.value || null;
  obj.Pet_name = document.getElementById('reportPetName')?.value || null;
  obj.Pet_type = document.getElementById('reportPetType')?.value || null;
  obj.Sex = document.querySelector('.sex-toggle .sex-btn.active')?.dataset.value || null;
  obj.Address_Lost = document.getElementById('reportAddress')?.value || null;
  obj.Description = document.getElementById('reportNotes')?.value || null;

  api.submitReport(currentReportType, obj).then(res => {
    closeModal('reportModal');
    setTimeout(() => {
      openModalById(currentReportType === 'lost' ? 'lostSuccessModal' : 'foundSuccessModal');
    }, 150);
  }).catch(err => {
    console.error(err);
    alert('Could not submit report.');
  });
}

/* ── Mock Pet Data ───────────────────────────
   TODO backend: replace with api.getReports()
─────────────────────────────────────────────── */
const petData = [
  {
    status:   'lost',
    img:      '../images/img/pet-1.jpg',
    name:     'Unknown',
    caseId:   'VT-8829-LP',
    breed:    'Beagle', age: 'Unknown', size: 'Medium', sex: 'Unknown',
    markings: 'No information provided.',
    date:     'October 24, 2024',
    location: 'Tangos, Baliwag'
  },
  {
    status:   'found',
    img:      '../images/img/pet-2.jpg',
    name:     'Unknown',
    reportId: '#VET-88392-LF',
    breed:    'Tuxedo Cat',
    foundAt:  'Poblacion, Baliwag', dateFound: 'Oct 25, 2024',
    size:     'Medium', sex: 'Unknown', color: 'Orange tabby',
    notes:    'Found near Poblacion area. Friendly and approachable. No collar.'
  },
  {
    status:   'lost',
    img:      '../images/img/pet-3.jpg',
    name:     'Unknown',
    caseId:   'VT-8830-LP',
    breed:    'Retriever', age: 'Unknown', size: 'Large', sex: 'Unknown',
    markings: 'No information provided.',
    date:     'October 22, 2024',
    location: 'Sabang, Baliwag'
  },
  {
    status:   'found',
    img:      '../images/img/pet-4.png',
    name:     'Unknown',
    reportId: '#VET-88393-LF',
    breed:    'Persian',
    foundAt:  'Sta. Barbara, Baliwag', dateFound: 'Oct 26, 2024',
    size:     'Small', sex: 'Unknown', color: 'White / cream fur',
    notes:    'Found wandering near Sta. Barbara. Appears well-groomed.'
  }
];

/* ── View Details (PUBLIC — read-only) ───────
   No claim button here. Lost pets show "I've Seen This Pet" (sighting).
   Found pets show "I Know This Pet's Owner" (sighting).
   Claim flow is ONLY from the matches panel.
─────────────────────────────────────────────── */
function viewDetails(index) {
  const pet = petData[index];
  if (!pet) return;

  if (pet.status === 'lost') {
    document.getElementById('detailsPetImg').src          = pet.img;
    document.getElementById('detailsPetName').textContent = pet.name;
    document.getElementById('detailsCaseId').textContent  = 'Case ID: ' + pet.caseId;
    document.getElementById('dBreed').textContent         = pet.breed;
    document.getElementById('dAge').textContent           = pet.age;
    document.getElementById('dSize').textContent          = pet.size;
    document.getElementById('dSex').textContent           = pet.sex;
    document.getElementById('dMarkings').textContent      = pet.markings;
    document.getElementById('dDate').textContent          = pet.date;
    document.getElementById('dLocation').textContent      = pet.location;
    openModalById('detailsLostModal');
  } else {
    document.getElementById('detailsFoundImg').src          = pet.img;
    document.getElementById('detailsFoundName').textContent = pet.name;
    document.getElementById('dReportId').textContent        = 'Report ID: ' + pet.reportId;
    document.getElementById('dFoundAt').textContent         = pet.foundAt;
    document.getElementById('dDateFound').textContent       = pet.dateFound;
    document.getElementById('dFoundSize').textContent       = pet.size;
    document.getElementById('dFoundSex').textContent        = pet.sex;
    document.getElementById('dFoundColor').textContent      = pet.color;
    document.getElementById('dFoundNotes').textContent      = pet.notes;
    openModalById('detailsFoundModal');
  }
}

/* ── Sighting ─────────────────────────────── */
function openSightingModal() {
  closeModal('detailsLostModal');
  closeModal('detailsFoundModal');
  setTimeout(() => openModalById('sightingModal'), 150);
}

function submitSighting() {
  const obj = {};
  obj.user_ID = getCurrentUser() ? getCurrentUser().id : 1;
  obj.Date_sighted = document.getElementById('sightingDate')?.value || null;
  obj.time_sighted = document.getElementById('sightingTime')?.value || null;
  obj.location_sighted = document.getElementById('sightingLocation')?.value || null;
  obj.description = document.getElementById('sightingNotes')?.value || null;
  api.submitSighting(obj).then(res => {
    closeModal('sightingModal');
    setTimeout(() => openModalById('sightingSuccessModal'), 150);
  }).catch(err => { console.error(err); alert('Could not submit sighting'); });
}

function openClaimModal() {
  closeModal('detailsFoundModal');
  setTimeout(() => openModalById('claimModal'), 150);
}

/* ── Claim (from matches panel only) ─────── */
function submitClaim() {
  const reportId = document.getElementById('claimReportId')?.value || null;
  const formObj = { proof: document.querySelector('.proof-option.active')?.dataset.value || null };
  api.submitClaim(reportId, formObj).then(res => {
    closeModal('claimModal');
    setTimeout(() => openModalById('claimSuccessModal'), 150);
  }).catch(err => { console.error(err); alert('Could not submit claim'); });
}

function selectProof(btn) {
  document.querySelectorAll('.proof-option').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ── Sex Toggle ───────────────────────────── */
function setSex(btn) {
  const parent = btn.closest('.sex-toggle');
  parent.querySelectorAll('.sex-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ── Use Account Info ─────────────────────── */
function toggleAccountInfo(btn) {
  const toggle = document.getElementById('accountToggle');
  const isOn   = toggle.classList.toggle('on');
  const name   = document.getElementById('contactName');
  const phone  = document.getElementById('contactPhone');
  const email  = document.getElementById('contactEmail');

  if (isOn) {
    /* TODO backend: fill from api.getProfile() session data */
    if (name)  name.value  = 'Mark Depa';
    if (phone) phone.value = '09959210640';
    if (email) email.value = 'mark@email.com';
  } else {
    if (name)  name.value  = '';
    if (phone) phone.value = '';
    if (email) email.value = '';
  }
}

/* ── Filter Panel ─────────────────────────── */
function toggleFilterPanel() {
  const dd  = document.getElementById('filterDropdown');
  const btn = document.getElementById('filterBtn');
  if (dd)  dd.classList.toggle('open');
  if (btn) btn.classList.toggle('active');
}

document.addEventListener('click', function (e) {
  const panel = document.querySelector('.filter-panel-wrap');
  const dd    = document.getElementById('filterDropdown');
  if (dd && !panel?.contains(e.target)) {
    dd.classList.remove('open');
    document.getElementById('filterBtn')?.classList.remove('active');
  }
});

/* ── Filter Chips ─────────────────────────── */
const activeFilters = { barangay: [], type: [], date: [] };

function toggleChip(btn, group) {
  btn.classList.toggle('selected');
  const val = btn.textContent.trim();
  const arr = activeFilters[group];
  const idx = arr.indexOf(val);
  if (idx === -1) arr.push(val);
  else arr.splice(idx, 1);
}

function clearFilters() {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('selected'));
  Object.keys(activeFilters).forEach(k => activeFilters[k] = []);
}

function applyFilters() {
  /* TODO backend: api.getReports(activeFilters).then(renderGrid) */
  console.log('Active filters:', activeFilters);
  document.getElementById('filterDropdown')?.classList.remove('open');
  document.getElementById('filterBtn')?.classList.remove('active');
}

/* ── Init: check URL params ─────────────── */
document.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'myreports') {
    showMyReports(document.getElementById('tab-myreports'));
  }
  if (params.get('filter')) {
    const tab = document.getElementById('tab-' + params.get('filter'));
    if (tab) filterPets(params.get('filter'), tab);
  }
});