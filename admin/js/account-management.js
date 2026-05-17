    /**
     * VBetter – Account Management JS
     * Connected to: backend/admin-users.php
     */

    'use strict';

    /* ── API Configuration ──────────────────────────────────────── */
    const API_BASE = 'http://localhost/withbackend/BVETTER-MAIN/backend/admin-users.php';
    const BACKEND = 'http://localhost/withbackend/BVETTER-MAIN/backend';

// Add this function
async function loadBarangays() {
    const select = document.getElementById('reg_barangay');
    if (!select) return;
    try {
        const res  = await fetch(`${BACKEND}/barangay.php`);
        const data = await res.json();
        if (data.success) {
            // clear existing options first
            select.innerHTML = '<option value="">Select Barangay</option>';
            data.barangays.forEach(b => {
                const opt = document.createElement('option');
                opt.value       = b.barangay_id;
                opt.textContent = b.barangay;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Failed to load barangays:', err);
    }
}

    function getAuthHeaders() {
        const token = sessionStorage.getItem('bvetter_token');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': 'Bearer ' + token })
        };
    }

    /* ── State ──────────────────────────────────────────────────── */
    const PAGE_SIZE = 5;
    let allUsers      = [];
    let filteredUsers = [];
    let currentTab    = 'all';
    let currentPage   = 1;
    let pendingDeleteId = null;
    let pendingVerifyId = null;
    let isLoading     = false;

    /* ── Init ───────────────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        loadUsersFromAPI();
        wireTabs();
        wireSearch();
        wireAddModal();
        wireEditModal();
        wireUnblockModal();
        wireDeleteModal();
        wireVerifyModal();
        wirePagination();
        wireCloseButtons();
    });

    /* ── Load users from API ────────────────────────────────────── */
    async function loadUsersFromAPI() {
        isLoading = true;
        try {
            const token = sessionStorage.getItem('bvetter_token');
            console.log('Token from sessionStorage:', token ? 'Present (' + token.substring(0, 10) + '...)' : 'None (running in TEST MODE)');

            const headers = getAuthHeaders();
            console.log('Request headers:', headers);

            const response = await fetch(API_BASE, {
                method: 'GET',
                headers: headers
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Error response:', errorData);
                throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            console.log('Users loaded:', data.users?.length || 0);
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load users');
            }

            // Map database fields to UI expectations
            allUsers = (data.users || []).map(u => ({
                ...u,
                id: u.id,
                roleLabel: capitalizeRole(u.role)
            }));

            console.log('Mapped allUsers array:', allUsers);
            filteredUsers = [...allUsers];
            updateKPIs();
            renderTable();
        } catch (error) {
            console.error('Error loading users:', error);
            alert('Failed to load users: ' + error.message);
        } finally {
            isLoading = false;
        }
    }

    function capitalizeRole(role) {
        const map = {
            'admin': 'Administrator',
            'veterinarian': 'veterinarian',
            'Pet owner': 'Pet Owner'
        };
        return map[role] || role;
    }

    /* ── Generic close buttons ─────────────────────────────────── */
    function wireCloseButtons() {
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-close');
                const el = document.getElementById(id);
                if (el) el.hidden = true;
            });
        });
        // close on overlay click
        document.querySelectorAll('.am-modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', e => {
                if (e.target === overlay) overlay.hidden = true;
            });
        });
        // ESC
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.am-modal-overlay:not([hidden])').forEach(o => o.hidden = true);
            }
        });
    }

    /* ── KPIs ───────────────────────────────────────────────────── */
    function updateKPIs() {
        setEl('kpi-total',   allUsers.length);
        setEl('kpi-vet',     allUsers.filter(u => u.role === 'vet' && u.status === 'active').length);
        setEl('kpi-blocked', allUsers.filter(u => u.status === 'blocked').length);
    }

    /* ── Table ──────────────────────────────────────────────────── */
    function applyFilters() {
        const search = (document.getElementById('search-users')?.value || '').toLowerCase();
        filteredUsers = allUsers.filter(u => {
            const matchTab    = currentTab === 'all' || u.role === currentTab;
            const matchSearch = !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
            return matchTab && matchSearch;
        });
        currentPage = 1;
        renderTable();
    }

    function renderTable() {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;

        const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
        currentPage = Math.min(currentPage, totalPages);
        const start     = (currentPage - 1) * PAGE_SIZE;
        const pageUsers = filteredUsers.slice(start, start + PAGE_SIZE);

        setEl('showing-label', `Showing ${filteredUsers.length} of ${allUsers.length} members`);

        if (!pageUsers.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="am-loading-cell">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = pageUsers.map(u => {
            const initials = u.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
            const avatarEl = u.avatar
                ? `<img class="am-avatar" src="${u.avatar}" alt="${u.name}">`
                : `<div class="am-avatar-placeholder">${initials}</div>`;

            const roleCss = roleClass(u.roleLabel || u.role);

            const statusEl = `<span class="am-status ${u.status}"><span class="am-status-dot"></span>${capitalize(u.status)}</span>`;

            // Action buttons
            let actionsEl = '';
           if (u.status === 'pending') {
    actionsEl = `
        <button class="am-btn-approve" onclick="openVerifyModal('${u.id}')">Approve</button>
        <button class="am-btn-reject"  onclick="handleReject('${u.id}')">Reject</button>`;

} else if (u.status === 'blocked') {
    // blocked by system — admin can unblock or delete
    actionsEl = `
        <button class="am-btn-unblock" onclick="openUnblockModal('${u.id}')">Unblock</button>
        <button class="am-btn-delete"  onclick="openDeleteModal('${u.id}')" title="Delete user">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#E53E3E" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/>
            </svg>
        </button>`;

} else {
    // active — delete only, system handles blocking automatically
    actionsEl = `
        <button class="am-btn-delete" onclick="openDeleteModal('${u.id}')" title="Delete user">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#E53E3E" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/>
            </svg>
        </button>`;
}

            return `
                <tr data-id="${u.id}">
                    <td>
                        <div class="am-user-cell">
                            ${avatarEl}
                            <div>
                                <span class="am-user-name">${u.name}</span>
                                <span class="am-user-email">${u.email}</span>
                            </div>
                        </div>
                    </td>
                    <td><span class="am-role-badge ${roleCss}">${u.roleLabel || capitalize(u.role)}</span></td>
                    <td>${statusEl}</td>
                    <td>${formatDate(u.created)}</td>
                    <td><div class="am-actions-cell">${actionsEl}</div></td>
                </tr>`;
        }).join('');

        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    }

    /* ── Tabs ───────────────────────────────────────────────────── */
    function wireTabs() {
        document.querySelectorAll('.am-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.am-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTab = btn.dataset.tab;
                applyFilters();
            });
        });
    }

    /* ── Search ─────────────────────────────────────────────────── */
    function wireSearch() {
        document.getElementById('search-users')?.addEventListener('input', applyFilters);
    }

    /* ── Pagination ─────────────────────────────────────────────── */
    function wirePagination() {
        document.getElementById('prev-page')?.addEventListener('click', () => {
            if (currentPage > 1) { currentPage--; renderTable(); }
        });
        document.getElementById('next-page')?.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
            if (currentPage < totalPages) { currentPage++; renderTable(); }
        });
    }

    /* ── ADD USER MODAL ─────────────────────────────────────────── */
    function wireAddModal() {
        document.getElementById('btn-add-user')?.addEventListener('click', () => {
            document.getElementById('modal-add').hidden = false;
        });

        document.getElementById('add-submit')?.addEventListener('click', handleAddUser);

        wirePhotoPreview('add-photo-input', 'add-photo-preview');
    }

    async function handleAddUser() {
    const name       = document.getElementById('add-name')?.value.trim();
    const email      = document.getElementById('add-email')?.value.trim();
    const role       = document.getElementById('add-role')?.value;
    const status     = document.getElementById('add-status')?.value;
    const phone      = document.getElementById('add-phone')?.value.trim();
    const barangayId = document.getElementById('reg_barangay')?.value;  // ← add this

    if (!name || !email || !role) {
        alert('Please fill in all required fields (Name, Email, Role).');
        return;
    }

    if (!barangayId) {
        alert('Please select a barangay.');
        return;
    }

    try {
        const payload = {
            name,
            email,
            role,
            phone,
            barangay_id: barangayId,    // ← add this
            status: status || 'active'
        };

        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}: Failed to create user`);
        }

        alert(`User created!\nTemporary password: ${data.tempPassword}\nPlease share this with the user.`);
        document.getElementById('modal-add').hidden = true;
        clearFormById(['add-name','add-email','add-phone'], ['add-role','add-status']);
        await loadUsersFromAPI();
    } catch (error) {
        console.error('Error creating user:', error);
        alert('Error: ' + error.message);
    }
}

    /* ── EDIT USER MODAL ────────────────────────────────────────── */
    function wireEditModal() {
        document.getElementById('edit-submit')?.addEventListener('click', handleEditUser);
        wirePhotoPreview('edit-photo-input', 'edit-photo-preview');
    }

    async function handleEditUser() {
        const id = document.getElementById('edit-user-id')?.value;
        const name   = document.getElementById('edit-name')?.value.trim();
        const email  = document.getElementById('edit-email')?.value.trim();
        const phone  = document.getElementById('edit-phone')?.value.trim();
        const role   = document.getElementById('edit-role')?.value;
        const status = document.getElementById('edit-status')?.value;

        try {
            const response = await fetch(`${API_BASE}?id=${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name, email, phone, role, status
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update user');
            }

            alert('User updated successfully!');
            document.getElementById('modal-edit').hidden = true;
            await loadUsersFromAPI();
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Error: ' + error.message);
        }
    }

    function openEditModal(id) {
        console.log('openEditModal called with id:', id);
        console.log('allUsers array length:', allUsers.length);
        console.log('allUsers:', allUsers);
        
        // If allUsers is empty, the API might still be loading
        if (allUsers.length === 0) {
            alert('Please wait for users to load before editing.');
            return;
        }

        const user = allUsers.find(u => {
            console.log('Comparing:', u.id, '===', id, '?', u.id == id);
            return u.id == id; // Use == instead of === to handle string/number comparison
        });

        if (!user) {
            console.error('User not found with id:', id, 'Available IDs:', allUsers.map(u => u.id));
            alert('User not found. Please refresh the page and try again.');
            return;
        }

        console.log('Found user:', user);
        
        const editUserIdEl = document.getElementById('edit-user-id');
        const editNameEl = document.getElementById('edit-name');
        const editEmailEl = document.getElementById('edit-email');
        const editPhoneEl = document.getElementById('edit-phone');
        const editRoleEl = document.getElementById('edit-role');
        const editStatusEl = document.getElementById('edit-status');
        const editModalEl = document.getElementById('modal-edit');

        if (!editUserIdEl || !editNameEl || !editEmailEl || !editRoleEl || !editStatusEl || !editModalEl) {
            console.error('Modal elements not found');
            alert('Error: Modal form elements not found');
            return;
        }

        editUserIdEl.value = id;
        editNameEl.value = user.name;
        editEmailEl.value = user.email;
        editPhoneEl.value = user.phone || '';
        setSelectValue('edit-role', user.role);
        setSelectValue('edit-status', user.status);

        editModalEl.hidden = false;
        console.log('Edit modal opened successfully');
    }

    /* ── UNBLOCK MODAL ──────────────────────────────────────────── */
    function wireUnblockModal() {
        document.getElementById('unblock-confirm-btn')?.addEventListener('click', handleUnblock);
        document.getElementById('unblock-save-btn')?.addEventListener('click', handleUnblockAndSave);
        wirePhotoPreview('unblock-photo-input', 'unblock-photo-preview');
    }

    async function handleUnblock() {
        const id = document.getElementById('unblock-user-id')?.value;
        try {
            const response = await fetch(`${API_BASE}?id=${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: 'active' })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to unblock user');
            }

            alert('User unblocked successfully!');
            document.getElementById('modal-unblock').hidden = true;
            await loadUsersFromAPI();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    async function handleUnblockAndSave() {
        const id = document.getElementById('unblock-user-id')?.value;
        const phone = document.getElementById('unblock-phone')?.value.trim();
        const status = document.getElementById('unblock-status')?.value;

        try {
            const response = await fetch(`${API_BASE}?id=${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ phone, status })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update user');
            }

            alert('User updated successfully!');
            document.getElementById('modal-unblock').hidden = true;
            await loadUsersFromAPI();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    function openUnblockModal(id) {
        const user = allUsers.find(u => u.id === id);
        if (!user) return;

        document.getElementById('unblock-user-id').value = id;
        document.getElementById('unblock-name').value    = user.name;
        document.getElementById('unblock-email').value   = user.email;
        document.getElementById('unblock-phone').value   = user.phone || '';
        setSelectValue('unblock-role',   user.role);
        setSelectValue('unblock-status', user.status);

        document.getElementById('modal-unblock').hidden = false;
    }

    /* ── DELETE MODAL ───────────────────────────────────────────── */
    function wireDeleteModal() {
        document.getElementById('delete-confirm-btn')?.addEventListener('click', handleDeleteUser);
    }

    async function handleDeleteUser() {
        if (!pendingDeleteId) return;

        try {
            const response = await fetch(`${API_BASE}?id=${pendingDeleteId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete user');
            }

            alert('User deleted successfully!');
            pendingDeleteId = null;
            document.getElementById('modal-delete').hidden = true;
            await loadUsersFromAPI();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    function openDeleteModal(id) {
        console.log('openDeleteModal called with id:', id);
        console.log('allUsers array length:', allUsers.length);
        
        if (allUsers.length === 0) {
            alert('Please wait for users to load before deleting.');
            return;
        }

        const user = allUsers.find(u => u.id == id); // Use == for type flexibility
        if (!user) {
            console.error('User not found with id:', id, 'Available IDs:', allUsers.map(u => u.id));
            alert('User not found. Please refresh the page and try again.');
            return;
        }

        pendingDeleteId = id;
        const initials = user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
        
        const deleteAvatarEl = document.getElementById('delete-avatar');
        const deleteUserNameEl = document.getElementById('delete-user-name');
        const deleteModalEl = document.getElementById('modal-delete');

        if (!deleteAvatarEl || !deleteUserNameEl || !deleteModalEl) {
            console.error('Delete modal elements not found');
            alert('Error: Modal form elements not found');
            return;
        }

        deleteAvatarEl.textContent = initials;
        deleteUserNameEl.textContent = user.name;
        deleteModalEl.hidden = false;
        
        console.log('Delete modal opened successfully');
    }

    /* ── VERIFY MODAL ───────────────────────────────────────────── */
    function wireVerifyModal() {
        document.getElementById('verify-approve-btn')?.addEventListener('click', handleApproveUser);
        document.getElementById('verify-reject-btn')?.addEventListener('click', handleRejectUser);
    }

    async function handleApproveUser() {
        if (!pendingVerifyId) return;

        try {
            const response = await fetch(`${API_BASE}?id=${pendingVerifyId}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: 'active', verify: true })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to approve user');
            }

            alert('User approved successfully!');
            pendingVerifyId = null;
            document.getElementById('modal-verify').hidden = true;
            await loadUsersFromAPI();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    async function handleRejectUser() {
        if (!pendingVerifyId) return;

        try {
            const response = await fetch(`${API_BASE}?id=${pendingVerifyId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to reject user');
            }

            alert('User rejected and deleted!');
            pendingVerifyId = null;
            document.getElementById('modal-verify').hidden = true;
            await loadUsersFromAPI();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    function openVerifyModal(id) {
        console.log('openVerifyModal called with id:', id);
        
        if (allUsers.length === 0) {
            alert('Please wait for users to load.');
            return;
        }

        const user = allUsers.find(u => u.id == id); // Use == for type flexibility
        if (!user) {
            console.error('User not found with id:', id, 'Available IDs:', allUsers.map(u => u.id));
            alert('User not found. Please refresh the page and try again.');
            return;
        }
        
        pendingVerifyId = id;
        
        const verifyNameEl = document.getElementById('verify-name');
        const verifyEmailEl = document.getElementById('verify-email');
        const verifyBarangayEl = document.getElementById('verify-barangay');
        const verifyIdImg = document.getElementById('verify-id-img');
        const verifyModalEl = document.getElementById('modal-verify');

        if (!verifyNameEl || !verifyEmailEl || !verifyBarangayEl || !verifyModalEl) {
            console.error('Verify modal elements not found');
            alert('Error: Modal form elements not found');
            return;
        }

        verifyNameEl.textContent = user.name;
        verifyEmailEl.textContent = user.email;
        verifyBarangayEl.textContent = user.barangay || '—';

        if (verifyIdImg) {
            verifyIdImg.src = user.idImage || 'https://placehold.co/500x300?text=No+ID+Uploaded';
        }

        verifyModalEl.hidden = false;
        console.log('Verify modal opened successfully');
    }

    /* ── Actions ────────────────────────────────────────────────── */
    async function handleReject(id) {
        const user = allUsers.find(u => u.id === id);
        if (!user) return;
        if (!confirm(`Reject application for ${user.name}?`)) return;

        try {
            const response = await fetch(`${API_BASE}?id=${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to reject user');
            }

            alert('User rejected!');
            await loadUsersFromAPI();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    /* ── Photo preview helper ───────────────────────────────────── */
    function wirePhotoPreview(inputId, previewId) {
        const input   = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        if (!input || !preview) return;

        input.addEventListener('change', () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        });
    }

    /* ── Helpers ─────────────────────────────────────────────────── */
    function roleClass(label) {
        const map = {
            'Veterinarian I':   'am-role-vet-i',
            'Veterinarian II':  'am-role-vet-ii',
            'Veterinarian III': 'am-role-vet-iii',
            'Pet Owner':        'am-role-owner',
            'Administrator':    'am-role-admin',
            'vet':              'am-role-vet',
            'owner':            'am-role-owner',
            'admin':            'am-role-admin',
        };
        return map[label] || 'am-role-vet';
    }

    function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }

    function setEl(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function setSelectValue(selectId, value) {
        const el = document.getElementById(selectId);
        if (!el) return;
        for (let opt of el.options) {
            if (opt.value === value) { opt.selected = true; break; }
        }
    }

    function clearFormById(textIds = [], selectIds = []) {
        textIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        selectIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.selectedIndex = 0;
        });
    }
    document.addEventListener('DOMContentLoaded', () => {
    loadUsersFromAPI();
    loadBarangays();    // ← add this line
    wireTabs();
    // ... rest
});
async function handleBlock(id) {
    const user = allUsers.find(u => u.id == id);
    if (!user) return;
    if (!confirm(`Block ${user.name}? They will not be able to login.`)) return;

    try {
        const response = await fetch(`${API_BASE}?id=${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: 'blocked' })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to block user');

        await loadUsersFromAPI();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}