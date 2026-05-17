/* =============================================
   BVETTER — Appointment API Loader
   File: vet/js/appointment-api.js

   ADD THIS SCRIPT TAG to appointment.html
   BEFORE appointment.js:
     <script src="/vet/js/appointment-api.js"></script>
     <script src="/vet/js/appointment.js"></script>

   This file fetches real appointments from PHP
   and sets window.appointmentDataset so that
   appointment.js uses real data instead of
   FALLBACK_APPOINTMENTS.

   appointment.js already checks:
     Array.isArray(window.appointmentDataset)
       ? window.appointmentDataset
       : FALLBACK_APPOINTMENTS
   So this file just sets that variable before
   appointment.js runs.
   ============================================= */

const APPT_BACKEND = 'http://localhost/withbackend/BVETTER-MAIN/backend/appointment.php';

/* ── Fetch appointments before page loads ─── */
(async function () {
    try {
        const res  = await fetch(APPT_BACKEND);
        const data = await res.json();

        if (data.success && Array.isArray(data.appointments)) {
            // appointment.js reads this variable on init
            window.appointmentDataset = data.appointments;
            console.log(`Loaded ${data.appointments.length} appointments from DB`);
        } else {
            console.warn('No appointments returned, using fallback data');
            window.appointmentDataset = null;
        }
    } catch (err) {
        console.error('Failed to load appointments:', err);
        window.appointmentDataset = null;
    }
})();

/* ── Patch: wire API calls to modal actions ──
   After appointment.js loads, override the
   applyReschedule, applyComplete, applyCancel,
   applyDelete functions to also call the PHP API.

   Uses a MutationObserver trick to run after
   appointment.js finishes loading.
   ─────────────────────────────────────────── */
window.addEventListener('load', function () {

    // ── Accept single appointment ─────────────
    // Override updateStatus to also call PATCH
    const originalUpdateStatus = window.updateStatus;
    if (typeof originalUpdateStatus === 'function') {
        window.updateStatus = async function (id, nextStatus) {
            originalUpdateStatus(id, nextStatus);
            try {
                await fetch(`${APPT_BACKEND}?id=${id}`, {
                    method:  'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ status: nextStatus }),
                });
            } catch (err) {
                console.error('Failed to update status:', err);
            }
        };
    }

    // ── Delete appointment ────────────────────
    const originalRemove = window.removeAppointment;
    if (typeof originalRemove === 'function') {
        window.removeAppointment = async function (id) {
            originalRemove(id);
            try {
                await fetch(`${APPT_BACKEND}?id=${id}`, {
                    method:  'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (err) {
                console.error('Failed to delete appointment:', err);
            }
        };
    }

    // ── Reschedule ────────────────────────────
    const originalReschedule = window.applyReschedule;
    if (typeof originalReschedule === 'function') {
        window.applyReschedule = async function () {
            // get the id and new date/time from state before calling original
            const apptId   = window.state?.selectedAppointmentId;
            const newDate  = window.state?.selectedDate;
            const newSlot  = window.state?.selectedSlot;

            originalReschedule();   // updates local state + closes modal

            if (apptId && newDate && newSlot) {
                try {
                    await fetch(`${APPT_BACKEND}?id=${apptId}`, {
                        method:  'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({
                            status:         'confirmed',
                            scheduled_date: newDate,
                            scheduled_time: newSlot + ':00',
                        }),
                    });
                } catch (err) {
                    console.error('Failed to save reschedule:', err);
                }
            }
        };
    }

    // ── Accept All button ─────────────────────
    // Override to also update all pending in DB
    const acceptAllBtn = document.getElementById('accept-butt');
    if (acceptAllBtn) {
        // clone to remove old listener
        const newBtn = acceptAllBtn.cloneNode(true);
        acceptAllBtn.parentNode.replaceChild(newBtn, acceptAllBtn);

        newBtn.addEventListener('click', async () => {
            // get all pending IDs before state changes
            const pendingIds = (window.state?.appointments || [])
                .filter(a => a.status === 'pending')
                .map(a => a.id);

            // update local state
            if (window.state?.appointments) {
                window.state.appointments.forEach(a => {
                    if (a.status === 'pending') a.status = 'confirmed';
                });
                window.refreshUI?.();
            }

            // update each in DB
            for (const id of pendingIds) {
                try {
                    await fetch(`${APPT_BACKEND}?id=${id}`, {
                        method:  'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ status: 'confirmed' }),
                    });
                } catch (err) {
                    console.error(`Failed to confirm appointment ${id}:`, err);
                }
            }
        });
    }
});