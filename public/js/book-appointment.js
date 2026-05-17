/* =============================================
   BVETTER — Book Appointment JS
   File: public/js/book-appointment.js
   ============================================= */

const BACKEND   = 'http://localhost/withbackend/BVETTER-MAIN/backend';
const APPT_API  = `${BACKEND}/appointment.php`;
const VETS_API  = `${BACKEND}/vets.php`;
const AVAIL_API = `${BACKEND}/availability.php`;

let selectedVetId   = null;
let selectedVetName = '';

/* ── Page navigation ──────────────────────── */
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page' + name.charAt(0).toUpperCase() + name.slice(1))?.classList.add('active');
    if (name === 'history') loadHistory();
}

/* ── Stepper ──────────────────────────────── */
let currentStep = 1;
const totalSteps = 4;

function showStep(n) {
    for (let i = 1; i <= totalSteps + 1; i++) {
        const el = document.getElementById(`step${i}`);
        if (el) el.style.display = i === n ? 'block' : 'none';
    }
    currentStep = n;
    updateStepper(n);
    const eyebrow = document.getElementById('bookingEyebrow');
    if (eyebrow && n <= totalSteps) eyebrow.textContent = `Step ${n} of ${totalSteps}`;
}

function updateStepper(n) {
    for (let i = 1; i <= totalSteps; i++) {
        const circle = document.getElementById(`sc${i}`);
        const label  = document.getElementById(`sl${i}`);
        const line   = document.getElementById(`line${i}`);
        if (!circle) continue;
        circle.classList.remove('active', 'done', 'todo');
        label?.classList.remove('active');
        if (i < n)      { circle.classList.add('done');   circle.textContent = '✓'; }
        else if (i ===n){ circle.classList.add('active');  circle.textContent = i; label?.classList.add('active'); }
        else            { circle.classList.add('todo');    circle.textContent = i; }
        if (line) line.classList.toggle('active', i < n);
    }
}

/* ══════════════════════════════════════════
   LOAD VETS FROM DB
══════════════════════════════════════════ */
async function loadVets() {
    const sidebar = document.querySelector('.vet-sidebar');
    if (!sidebar) return;

    try {
        const res  = await fetch(VETS_API);
        const data = await res.json();

        // remove hardcoded vet items
        sidebar.querySelectorAll('.vet-item').forEach(el => el.remove());

        if (!data.success || !data.vets.length) {
            sidebar.innerHTML += '<p style="color:#888;font-size:13px;padding:12px">No vets available.</p>';
            return;
        }

        data.vets.forEach((vet, i) => {
            const item = document.createElement('div');
            item.className = 'vet-item' + (i === 0 ? ' active' : '');
            item.dataset.vetId = vet.id;
            item.innerHTML = `
                ${vet.profile_image
                    ? `<img src="${vet.profile_image}" alt="${vet.name}" class="vet-thumb"/>`
                    : `<div class="vet-thumb" style="background:#e8f5e9;display:flex;align-items:center;justify-content:center;font-weight:700;color:#2f8243;border-radius:50%;width:40px;height:40px;">${vet.initials}</div>`
                }
                <div>
                    <div class="vet-item-name">${vet.name}</div>
                    <div class="vet-item-role">${vet.title}</div>
                </div>`;

            item.addEventListener('click', () => selectVet(vet, item));
            sidebar.appendChild(item);

            if (i === 0) selectVet(vet, item);
        });

    } catch (err) {
        console.error('Failed to load vets:', err);
    }
}

function selectVet(vet, clickedItem) {
    selectedVetId   = vet.id;
    selectedVetName = vet.name;

    document.querySelectorAll('.vet-item').forEach(el => el.classList.remove('active'));
    clickedItem.classList.add('active');

    // update profile card
    const q = (sel) => document.querySelector(sel);
    const n = (sel, val) => { const el = q(sel); if (el) el.textContent = val; };

    n('.vet-profile-name',  'Dr. ' + vet.name);
    n('.vet-profile-title', vet.title);
    n('.rating-num',        vet.rating || '4.5');

    const clinicEl = q('.vet-profile-clinic');
    if (clinicEl) clinicEl.innerHTML = `
        <img src="../images/icons/icon-location.svg" alt="" class="info-icon"/>
        ${vet.barangay || 'Baliwag Vet Clinic'}`;

    const img = q('.vet-profile-img');
    if (img && vet.profile_image) img.src = vet.profile_image;

    // update booking page preview
    n('.vet-booked-initials', vet.initials);
    n('.vet-booked-name',     'Dr. ' + vet.name);
    n('.vet-booked-role',     vet.title);

    // re-check availability
    const dateEl = document.getElementById('apptDate');
    if (dateEl?.value) checkAvailability(vet.id, dateEl.value);
}

/* ══════════════════════════════════════════
   AVAILABILITY
══════════════════════════════════════════ */
async function checkAvailability(vetId, date) {
    if (!vetId || !date) return;
    try {
        const res  = await fetch(`${AVAIL_API}?vet_id=${vetId}&date=${date}`);
        const data = await res.json();
        if (!data.success) return;

        document.querySelectorAll('.slot-btn').forEach(btn => {
            const btnTime = convertLabelToTime(btn.dataset.slot);
            const slot    = data.all_slots.find(s => s.time === btnTime);
            if (!slot) return;

            if (!slot.available) {
                btn.disabled = true;
                btn.classList.add('slot-unavailable');
                btn.classList.remove('selected');
                btn.title = 'Already booked';
            } else {
                btn.disabled = false;
                btn.classList.remove('slot-unavailable');
                btn.title = '';
            }
        });
    } catch (err) {
        console.error('Availability check failed:', err);
    }
}

function convertLabelToTime(label) {
    if (!label) return '';
    const [time, period] = label.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function to24hr(label) {
    return label ? convertLabelToTime(label) + ':00' : '09:00:00';
}

/* ── Form data ────────────────────────────── */
function getFormData() {
    const selectedSlot = document.querySelector('.slot-btn.selected');
    const timeLabel    = selectedSlot ? selectedSlot.dataset.slot : '';
    return {
        owner_name: document.getElementById('ownerName')?.value.trim(),
        contact:    document.getElementById('ownerContact')?.value.trim(),
        email:      document.getElementById('ownerEmail')?.value.trim(),
        barangay:   document.getElementById('ownerBarangay')?.value,
        address:    document.getElementById('ownerAddress')?.value.trim(),
        pet: {
            name:  document.getElementById('petName')?.value.trim(),
            type:  document.getElementById('petType')?.value,
            breed: document.getElementById('petBreed')?.value.trim(),
            age:   document.getElementById('petAge')?.value.trim(),
            sex:   document.getElementById('petSex')?.value,
        },
        visit_type: document.getElementById('visitType')?.value,
        date:       document.getElementById('apptDate')?.value,
        time:       to24hr(timeLabel),
        time_label: timeLabel,
        notes:      document.getElementById('apptNotes')?.value.trim(),
        vet_id:     selectedVetId,
        vet_name:   selectedVetName,
    };
}

function populateReview() {
    const d = getFormData();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('rv-name',      d.owner_name);
    set('rv-contact',   d.contact);
    set('rv-barangay',  d.barangay);
    set('rv-petname',   d.pet.name);
    set('rv-pettype',   d.pet.type);
    set('rv-ageSex',    `${d.pet.age} / ${d.pet.sex}`);
    set('rv-visitType', d.visit_type);
    set('rv-date',      d.date);
    set('rv-time',      d.time_label);
}

/* ── Validation ───────────────────────────── */
function validateStep(step) {
    if (step === 1) {
        if (!selectedVetId) { alert('Please select a veterinarian first.'); showPage('vet'); return false; }
        const f = ['ownerName','ownerContact','ownerEmail','ownerBarangay','ownerAddress'];
        if (f.some(id => !document.getElementById(id)?.value.trim())) {
            alert('Please fill in all owner information fields.');
            return false;
        }
    }
    if (step === 2) {
        if (!document.getElementById('petName')?.value.trim())  { alert('Please enter pet name.'); return false; }
        if (!document.getElementById('petBreed')?.value.trim()) { alert('Please enter pet breed.'); return false; }
    }
    if (step === 3) {
        if (!document.getElementById('apptDate')?.value) { alert('Please select a date.'); return false; }
        const slot = document.querySelector('.slot-btn.selected');
        if (!slot)          { alert('Please select a time slot.'); return false; }
        if (slot.disabled)  { alert('That slot is already booked. Please choose another.'); return false; }
    }
    return true;
}

/* ── Submit booking ───────────────────────── */
async function submitBooking() {
    const user    = typeof getCurrentUser === 'function'
        ? getCurrentUser()
        : JSON.parse(sessionStorage.getItem('bvetter_user') || '{}');
    const user_id = user?.id || user?.user_id;

    if (!user_id) {
        alert('You must be logged in to book an appointment.');
        window.location.href = 'login.html';
        return;
    }

    const data = getFormData();

    // last-second availability check
    if (selectedVetId && data.date && data.time_label) {
        const avRes   = await fetch(`${AVAIL_API}?vet_id=${selectedVetId}&date=${data.date}`);
        const avData  = await avRes.json();
        if (avData.success) {
            const slotTime = convertLabelToTime(data.time_label);
            const slot     = avData.all_slots.find(s => s.time === slotTime);
            if (slot && !slot.available) {
                alert('Sorry, that slot was just booked. Please choose another time.');
                checkAvailability(selectedVetId, data.date);
                showStep(3);
                return;
            }
        }
    }

    const btn = document.getElementById('s4Confirm');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    try {
        const res    = await fetch(APPT_API, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ...data, user_id }),
        });
        const result = await res.json();

        if (result.success) {
            const refEl = document.querySelector('.ref-val');
            if (refEl) refEl.textContent = '#' + result.reference;
            showStep(5);
        } else {
            alert(result.error || 'Booking failed.');
            if (btn) { btn.disabled = false; btn.textContent = 'Confirm Booking'; }
        }
    } catch (err) {
        console.error(err);
        alert('Something went wrong. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Confirm Booking'; }
    }
}

/* ── Load history ─────────────────────────── */
async function loadHistory() {
    const user    = typeof getCurrentUser === 'function'
        ? getCurrentUser()
        : JSON.parse(sessionStorage.getItem('bvetter_user') || '{}');
    const user_id = user?.id || user?.user_id;
    if (!user_id) return;

    try {
        const res  = await fetch(`${APPT_API}?user_id=${user_id}`);
        const data = await res.json();
        const histEmpty = document.getElementById('histEmpty');
        const histList  = document.getElementById('histList');

        if (!data.success || !data.appointments.length) {
            if (histEmpty) histEmpty.style.display = 'block';
            if (histList)  histList.style.display  = 'none';
            return;
        }

        if (histEmpty) histEmpty.style.display = 'none';
        if (histList)  histList.style.display  = 'block';

        histList.innerHTML = data.appointments.map(a => {
            const dt      = new Date(a.datetime);
            const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const sc      = { pending:'appt-pending', confirmed:'appt-confirmed', completed:'appt-completed', canceled:'appt-canceled' }[a.status] || 'appt-pending';
            const badge   = { pending:'s-pending', confirmed:'s-confirmed', completed:'s-completed', canceled:'s-canceled' }[a.status] || 's-pending';
            return `
                <div class="appt-row ${sc}">
                    <div class="appt-col"><div class="appt-col-label">PET NAME</div><div class="appt-pet-name">${a.patient}</div><div class="appt-pet-meta">${a.type}</div></div>
                    <div class="appt-col"><div class="appt-col-label">SERVICE</div><div class="appt-service-name">${a.service}</div><div class="appt-doctor">${a.vet_name && a.vet_name !== '—' ? 'Dr. '+a.vet_name : 'Pending assignment'}</div></div>
                    <div class="appt-col"><div class="appt-col-label">DATE</div><div class="appt-date-val">${dateStr}</div><div class="appt-time-val">${timeStr}</div></div>
                    <div class="appt-actions">
                        <span class="status-badge ${badge}"><span class="status-dot"></span>${a.status.charAt(0).toUpperCase()+a.status.slice(1)}</span>
                        ${a.status === 'completed' ? '<button class="btn-rate-review">Rate &amp; Review</button>' : ''}
                    </div>
                </div>`;
        }).join('');
    } catch (err) { console.error('History load failed:', err); }
}

/* ── Wire up ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    loadVets();

    // auto-fill from session
    const user = (typeof getCurrentUser === 'function' ? getCurrentUser() : null)
        || JSON.parse(sessionStorage.getItem('bvetter_user') || '{}');
    if (user) {
        const fullName = user.name || ((user.first_name||'') + ' ' + (user.last_name||'')).trim();
        const nameEl   = document.getElementById('ownerName');
        const emailEl  = document.getElementById('ownerEmail');
        const navName  = document.querySelector('.nav-user-name');
        if (nameEl  && fullName)    nameEl.value      = fullName;
        if (emailEl && user.email)  emailEl.value     = user.email;
        if (navName && fullName)    navName.textContent = fullName;
    }

    // slot selection
    document.querySelectorAll('.slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // date change → check availability
    document.getElementById('apptDate')?.addEventListener('change', e => {
        if (selectedVetId) checkAvailability(selectedVetId, e.target.value);
    });

    document.getElementById('btnBook')?.addEventListener('click', () => {
        if (!selectedVetId) { alert('Please select a veterinarian first.'); return; }
        showPage('booking'); showStep(1);
    });
    document.getElementById('btnBackToVet')?.addEventListener('click', () => showPage('vet'));
    document.getElementById('s1Next')?.addEventListener('click', () => { if (validateStep(1)) showStep(2); });
    document.getElementById('s2Back')?.addEventListener('click', () => showStep(1));
    document.getElementById('s2Next')?.addEventListener('click', () => { if (validateStep(2)) showStep(3); });
    document.getElementById('s3Back')?.addEventListener('click', () => showStep(2));
    document.getElementById('s3Next')?.addEventListener('click', () => { if (validateStep(3)) { populateReview(); showStep(4); } });
    document.getElementById('s4Back')?.addEventListener('click', () => showStep(3));
    document.getElementById('s4Confirm')?.addEventListener('click', submitBooking);
    document.getElementById('btnBackHome')?.addEventListener('click', () => showPage('vet'));
    document.getElementById('btnViewHistory')?.addEventListener('click', () => showPage('history'));
    document.getElementById('btnViewAll')?.addEventListener('click', e => { e.preventDefault(); showPage('history'); });
    document.getElementById('btnBookFromHistory')?.addEventListener('click', () => showPage('vet'));
    document.getElementById('btnHistBack')?.addEventListener('click', () => showPage('vet'));

    window.toggleUserMenu = () => document.getElementById('userDropdown')?.classList.toggle('show');
});

document.addEventListener('DOMContentLoaded', function () {

    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',

        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: ''
        },

        events: [
            {
                title: 'Dog Checkup',
                start: '2026-10-12'
            },
            {
                title: 'Cat Vaccine',
                start: '2026-10-15'
            }
        ]
    });

    calendar.render();
});