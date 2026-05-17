/* =============================================
   BVETTER — Login Page JS
   File: public/js/login.js
   Depends: ../../shared/js/auth.js

   SCRIPT ORDER on login.html:
     <script src="../../shared/js/auth.js"></script>
     <script src="../js/login.js"></script>

   Test credentials:
   owner@test.com  → pet owner → public/pages/landing.html
   vet@test.com    → vet staff → vet/html/index.html
   admin@test.com  → admin     → admin/pages/dashboard.html
   ============================================= */

/* ── Password visibility toggle ─────────────── */
function togglePassword() {
  var pw = document.getElementById('loginPassword');
  if (!pw) return;
  pw.type = pw.type === 'password' ? 'text' : 'password';
}

/* ── Login handler ─────────────────────────── */

async function handleLogin() {
    const email    = document.getElementById('loginEmail')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value || '';
    
    if (!email || !password) {
        alert('Please enter your email and password.');
        return;
    }

   const res = await api.login(email,password);

    if (res.success) {
        loginAs  ({
            id:    res.user.user_id,
            name:  res.user.first_name + ' ' + res.user.last_name,
            role:  mapRole(res.user.role),
            token: res.token,
            email: res.user.email,
    });
    console.log('Login successful:', res);
    // window.location.href = api.getRedirectUrl(res.user.role);
   
    } else {
        alert(res.message);
    }
}

function mapRole(dbRole) {
    const map = {
        'Pet owner':      'Pet owner',
        'veterinarian': 'veterinarian',
        'admin':     'admin',
    };
    return map[dbRole] || 'Pet owner';
}
