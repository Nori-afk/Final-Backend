/* =============================================
   BVETTER — Create Account JS
   File: js/signup.js
   Depends: api.js

   WHAT THIS FILE DOES:
   - Loads barangays from DB into dropdown
   - Handles 4-step form navigation
   - Validates each step before proceeding
   - Submits registration as FormData (because of file upload)
   - Shows reference number on success
   ============================================= */

const BASE = 'http://localhost/withbackend/BVETTER-MAIN/backend';

let currentStep = 1;

/* ── Load barangays from database ────────────
   Replaces the hardcoded <option> list in HTML.
   Fetches from barangay_masterlist table.       */
async function loadBarangays() {
    const select = document.getElementById('reg_barangay');
    if (!select) return;

    try {
        const res  = await fetch(`${BASE}/barangay.php`);
        const data = await res.json();

        if (data.success && data.barangays.length > 0) {
            data.barangays.forEach(b => {
                const option       = document.createElement('option');
                option.value       = b.barangay_id;   // sends ID to PHP
                option.textContent = b.barangay;       // shows name to user
                select.appendChild(option);
            });
        } else {
            console.error('No barangays returned from DB');
        }
    } catch (err) {
        console.error('Failed to load barangays:', err);
    }
}

/* ── Step navigation ──────────────────────────
   Validates current step before moving forward  */
function goTo(step) {
    // validate before moving forward
    if (step > currentStep) {
        if (!validateStep(currentStep)) return;
    }

    document.getElementById('step-' + currentStep).classList.remove('active');
    currentStep = step;
    document.getElementById('step-' + currentStep).classList.add('active');

    if (step === 3) reviewStep();
    updateStepper(step);
}

/* ── Validate each step ───────────────────────  */
function validateStep(step) {
    if (step === 1) {
        const fullname  = document.getElementById('reg_fullname')?.value.trim();
        const email     = document.getElementById('reg_email')?.value.trim();
        const pw1       = document.getElementById('reg_pw1')?.value;
        const pw2       = document.getElementById('reg_pw2')?.value;
        const barangay  = document.getElementById('reg_barangay')?.value;
        const terms     = document.getElementById('reg_terms')?.checked;

        if (!fullname) { alert('Please enter your full name.'); return false; }
        if (!email)    { alert('Please enter your email.'); return false; }
        if (!pw1 || pw1.length < 8) { alert('Password must be at least 8 characters.'); return false; }
        if (pw1 !== pw2) { alert('Passwords do not match.'); return false; }
        if (!barangay) { alert('Please select your barangay.'); return false; }
        if (!terms)    { alert('Please agree to the Terms of Service.'); return false; }
    }

    if (step === 2) {
        const proof = document.getElementById('reg_proof');
        if (!proof || proof.files.length === 0) {
            alert('Please upload your proof of residency.');
            return false;
        }

        const file      = proof.files[0];
        const maxSize   = 5 * 1024 * 1024; // 5MB
        const allowed   = ['image/jpeg', 'image/png', 'application/pdf'];

        if (!allowed.includes(file.type)) {
            alert('File must be JPG, PNG, or PDF.');
            return false;
        }
        if (file.size > maxSize) {
            alert('File size must not exceed 5MB.');
            return false;
        }
    }

    return true;
}

/* ── Submit registration ──────────────────────
   Called by "Confirm & Submit" button on step 3.
   Sends FormData (not JSON) because of file upload */
async function submitRegistration() {
    // split full name into first + last
    const fullname  = document.getElementById('reg_fullname').value.trim();
    const nameParts = fullname.split(' ');
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ') || firstName; // fallback

    const formData = new FormData();
    formData.append('first_name',  firstName);
    formData.append('last_name',   lastName);
    formData.append('email',       document.getElementById('reg_email').value.trim());
    formData.append('password',    document.getElementById('reg_pw1').value);
    formData.append('barangay_id', document.getElementById('reg_barangay').value);

    // attach proof file
    const proofFile = document.getElementById('reg_proof').files[0];
    if (proofFile) {
        formData.append('proof', proofFile);
    }

    // disable button to prevent double submit
    const submitBtn = document.querySelector('#step-3 .btn-primary');
    if (submitBtn) {
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Submitting...';
    }

    try {
        const res  = await fetch(`${BASE}/auth/register.php`, {
            method: 'POST',
            body:   formData
            // NOTE: do NOT set Content-Type header for FormData
            // browser sets it automatically with the correct boundary
        });
        const data = await res.json();

        if (data.success) {
            // show reference number on success screen
            document.getElementById('reg_ref_number').textContent = data.reference;
            goTo(4);
        } else {
            alert(data.message);
            if (submitBtn) {
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Confirm & Submit';
            }
        }
    } catch (err) {
        alert('Something went wrong. Please try again.');
        console.error(err);
        if (submitBtn) {
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Confirm & Submit';
        }
    }
}

/* ── Populate review step ─────────────────────  */
function reviewStep() {
    const fullname  = document.getElementById('reg_fullname')?.value  || '';
    const email     = document.getElementById('reg_email')?.value     || '';
    const pw1       = document.getElementById('reg_pw1')?.value       || '';
    const pw2       = document.getElementById('reg_pw2')?.value       || '';
    const barangay  = document.getElementById('reg_barangay');
    const proofFile = document.getElementById('reg_proof');

    document.getElementById('rv_fullname').value = fullname;
    document.getElementById('rv_email').value    = email;
    document.getElementById('rv_pw').value       = pw1;
    document.getElementById('rv_pw2').value      = pw2;

    if (barangay) {
        document.getElementById('rv_barangay').value =
            barangay.options[barangay.selectedIndex]?.text || '';
    }

    document.getElementById('rv_proof_name').textContent =
        (proofFile && proofFile.files.length > 0)
            ? proofFile.files[0].name
            : 'No file selected';
}

/* ── Stepper visual update ────────────────────  */
function updateStepper(step) {
    for (let i = 1; i <= 3; i++) {
        const circle = document.getElementById('circle-' + i);
        if (!circle) continue;
        circle.classList.remove('active', 'done');

        if (i < step) {
            circle.classList.add('done');
            circle.innerHTML = '&#10003;';
        } else if (i === step) {
            circle.classList.add('active');
            circle.textContent = i;
        } else {
            circle.textContent = i;
        }

        if (i < 3) {
            const line = document.getElementById('line-' + i);
            if (line) line.classList.toggle('active', i < step);
        }
    }
}

/* ── Password toggle ──────────────────────────  */
function togglePw(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
}

/* ── Copy reference number ────────────────────  */
function copyRef() {
    const ref = document.getElementById('reg_ref_number')?.textContent || '';
    navigator.clipboard.writeText(ref)
        .then(() => alert('Reference number copied!'))
        .catch(() => {});
}

/* ── Initialize on page load ──────────────────  */
updateStepper(1);
loadBarangays();   // fetch barangays from DB right away