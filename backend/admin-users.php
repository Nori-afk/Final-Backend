<?php
/* =============================================
   BVETTER — Admin User Management API
   File: backend/admin-users.php

   GET    /backend/admin-users.php              - Get all users
   POST   /backend/admin-users.php              - Create new user
   PATCH  /backend/admin-users.php?id=...      - Update user
   DELETE /backend/admin-users.php?id=...      - Delete user
   
   Requires: Bearer token with admin role
   ============================================= */
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'connection.php';

// ── TEST MODE: Bypass auth for testing (disable in production) ──
$TEST_MODE = true; // Set to false to require authentication

if (!$TEST_MODE) {
    // ── Verify admin auth ─────────────────────────
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($header, 'Bearer ')) {
        json_out(['error' => 'Unauthorized'], 401);
    }

    $token = substr($header, 7);
    $stmt = db()->prepare("
        SELECT u.user_id, r.Role_name 
        FROM user_table u
        JOIN role_table r ON u.Role_ID = r.Role_id
        WHERE u.Token = ? AND u.Token_expires > NOW()
    ");
    $stmt->execute([$token]);
    $adminUser = $stmt->fetch();

    if (!$adminUser || $adminUser['Role_name'] !== 'admin') {
        json_out(['error' => 'Admin access required'], 403);
    }
}

// ── Route by method ──────────────────────────
try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            handleGetUsers();
            break;
        case 'POST':
            handleCreateUser();
            break;
        case 'PATCH':
            handleUpdateUser();
            break;
        case 'DELETE':
            handleDeleteUser();
            break;
        default:
            json_out(['error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    json_out(['error' => $e->getMessage()], 500);
}

/* ────────────────────────────────────────────
   GET /backend/admin-users.php
   Returns all users with their info
   ──────────────────────────────────────────── */
function handleGetUsers() { 
$stmt = db()->prepare("
    SELECT
        u.user_id                                    AS id,
        CONCAT(n.First_name, ' ', n.Last_name)       AS name,
        u.Email                                      AS email,
        r.Role_name                                  AS dbRole,
        DATE_FORMAT(u.Created_at, '%Y-%m-%d')        AS created,
        u.Profile_image                              AS avatar,
        a.barangay                                   AS barangay,
        u.isBlocked                                  AS isBlocked,
        v.verified                                   AS verified,
        v.isverfied_image                            AS idImage
    FROM user_table u
    JOIN name_table             n ON u.Name_ID      = n.Name_id
    JOIN role_table             r ON u.Role_ID      = r.Role_id
    LEFT JOIN address_table     a ON u.Address_ID   = a.Address_ID
    LEFT JOIN is_verified_table v ON u.Isverfied_ID = v.Isverfied_ID
    ORDER BY u.Created_at DESC
");
$stmt->execute();
$rows = $stmt->fetchAll();

$roleMap = [
    'Pet owner'    => 'owner',
    'veterinarian' => 'vet',
    'admin'        => 'admin',
];
$roleLabelMap = [
    'Pet owner'    => 'Pet Owner',
    'veterinarian' => 'Veterinarian',
    'admin'        => 'Administrator',
];

$users = array_map(function($u) use ($roleMap, $roleLabelMap) {
    // ── correct status logic ──────────────────
    if ($u['isBlocked']) {
        $status = 'blocked';
    } elseif ($u['verified'] === null) {
        // no verification record = admin-created account = active
        $status = 'active';
    } elseif ($u['verified'] == 0) {
        // has verification record but not approved yet = pending
        $status = 'pending';
    } else {
        // verified = 1 = approved
        $status = 'active';
    }

    $role    = $roleMap[$u['dbRole']]      ?? 'owner';
    $idImage = null;
    if ($u['idImage']) {
        $idImage = 'http://localhost/withbackend/BVETTER-MAIN/' . $u['idImage'];
    }

    return [
        'id'        => $u['id'],
        'name'      => $u['name'],
        'email'     => $u['email'],
        'role'      => $role,
        'roleLabel' => $roleLabelMap[$u['dbRole']] ?? 'Pet Owner',
        'status'    => $status,
        'created'   => $u['created'],
        'barangay'  => $u['barangay'] ?? '—',
        'avatar'    => $u['avatar']   ?? '',
        'idImage'   => $idImage,
        'phone'     => '',
    ];
}, $rows);

json_out(['success' => true, 'users' => $users]);
}

/* ────────────────────────────────────────────
   POST /backend/admin-users.php
   Create new user
   Body: { name, email, role, status, phone, barangay }
   ──────────────────────────────────────────── */
function handleCreateUser() {
    $body = json_decode(file_get_contents('php://input'), true);

    $fullName    = trim($body['name']         ?? '');
    $email       = trim($body['email']        ?? '');
    $role        = trim($body['role']         ?? '');
    $barangayId  = (int)($body['barangay_id'] ?? 0);
    $phone       = trim($body['phone']        ?? '');
    $status      = trim($body['status']       ?? 'active');

    // ── Validate ──────────────────────────────
    if (!$fullName || !$email || !$role) {
        json_out(['error' => 'Name, email, and role are required'], 422);
    }
    if (!$barangayId) {
        json_out(['error' => 'Barangay is required'], 422);
    }

    // ── Map frontend role to DB role name ─────
    // role values come from HTML <option value="veterinarian"> etc.
    // these must match exactly what's in your role_table
    $allowed_roles = ['veterinarian', 'admin', 'Pet owner'];
    if (!in_array($role, $allowed_roles)) {
        json_out(['error' => 'Invalid role: ' . $role], 422);
    }

    // ── Get role ID ───────────────────────────
    $roleStmt = db()->prepare("SELECT Role_id FROM role_table WHERE Role_name = ?");
    $roleStmt->execute([$role]);
    $roleRow = $roleStmt->fetch();
    if (!$roleRow) {
        json_out(['error' => 'Role not found in database: ' . $role], 422);
    }

    // ── Get barangay name from masterlist ─────
    $brgyStmt = db()->prepare("SELECT barangay FROM barangay_masterlist WHERE barangay_id = ?");
    $brgyStmt->execute([$barangayId]);
    $brgyRow = $brgyStmt->fetch();
    if (!$brgyRow) {
        json_out(['error' => 'Invalid barangay'], 422);
    }

    // ── Split name ────────────────────────────
    $nameParts = explode(' ', $fullName, 2);
    $firstName = $nameParts[0];
    $lastName  = $nameParts[1] ?? '';

    // ── Step 1: Insert name_table ─────────────
    $nameStmt = db()->prepare("
        INSERT INTO name_table (First_name, Last_name)
        VALUES (?, ?)
    ");
    $nameStmt->execute([$firstName, $lastName]);
    $nameId = db()->lastInsertId();

    // ── Step 2: Insert address_table ──────────
    $addrStmt = db()->prepare("
        INSERT INTO address_table (barangay)
        VALUES (?)
    ");
    $addrStmt->execute([$brgyRow['barangay']]);
    $addressId = db()->lastInsertId();

    // ── Step 3: Generate temp password ────────
    $tempPassword   = bin2hex(random_bytes(4));  // 8-char password
    $hashedPassword = password_hash($tempPassword, PASSWORD_BCRYPT);

    // ── Step 4: Insert user_table ─────────────
    $isBlocked = ($status === 'blocked') ? 1 : 0;

    $userStmt = db()->prepare("
        INSERT INTO user_table
            (Name_ID, Address_ID, Password, Email, Role_ID, isBlocked, Created_at)
        VALUES
            (?, ?, ?, ?, ?, ?, NOW())
    ");
    $userStmt->execute([
        $nameId,
        $addressId,
        $hashedPassword,
        $email,
        $roleRow['Role_id'],
        $isBlocked,
    ]);

    $userId = db()->lastInsertId();

    json_out([
        'success'      => true,
        'message'      => 'User created successfully',
        'tempPassword' => $tempPassword,
        'user_id'      => $userId,
    ], 201);
}

/* ────────────────────────────────────────────
   PATCH /backend/admin-users.php?id=U-001
   Update user info
   Body: { name, email, phone, role, status }
   ──────────────────────────────────────────── */
function handleUpdateUser() {
    $userId = $_GET['id'] ?? null;
    if (!$userId) {
        json_out(['error' => 'User ID required'], 422);
    }

    $body = json_decode(file_get_contents('php://input'), true);

    // Update name if provided
    if (isset($body['name'])) {
        $nameParts = explode(' ', trim($body['name']), 2);
        $firstName = $nameParts[0];
        $lastName = $nameParts[1] ?? '';

        $stmt = db()->prepare("
            UPDATE name_table n
            JOIN user_table u ON u.Name_ID = n.Name_id
            SET n.First_name = ?, n.Last_name = ?
            WHERE u.user_id = ?
        ");
        $stmt->execute([$firstName, $lastName, $userId]);
    }

    // Update other fields
    $updates = [];
    $values = [];

    if (isset($body['email'])) {
        $updates[] = 'Email = ?';
        $values[] = trim($body['email']);
    }
    if (isset($body['role'])) {
        $roleStmt = db()->prepare("SELECT Role_id FROM role_table WHERE Role_name = ?");
        $roleNameMap = [
            'veterinarian'   => 'veterinarian',
            'admin' => 'admin',
            'Pet owner' => 'Pet owner',
        ];
        $dbRoleName = $roleNameMap[strtolower($body['role'])] ?? strtolower($body['role']);
        $roleStmt->execute([$dbRoleName]);
        $roleRow = $roleStmt->fetch();
        if ($roleRow) {
            $updates[] = 'Role_ID = ?';
            $values[] = $roleRow['Role_id'];
        }
    }
    if (isset($body['status'])) {
        if ($body['status'] === 'blocked') {
            $updates[] = 'isBlocked = 1';
        } else if ($body['status'] === 'active') {
            $updates[] = 'isBlocked = 0';
            // Approve pending users - set Isverfied_ID to NULL to mark as active
            if (isset($body['verify'])) {
                $updates[] = 'Isverfied_ID = NULL';
            }
        }
    }

    if (!empty($updates)) {
        $values[] = $userId;
        $sql = 'UPDATE user_table SET ' . implode(', ', $updates) . ' WHERE user_id = ?';
        $stmt = db()->prepare($sql);
        $stmt->execute($values);
    }

    json_out(['success' => true, 'message' => 'User updated successfully']);
}

/* ────────────────────────────────────────────
   DELETE /backend/admin-users.php?id=U-001
   Delete user
   ──────────────────────────────────────────── */
function handleDeleteUser() {
    $userId = $_GET['id'] ?? null;
    if (!$userId) {
        json_out(['error' => 'User ID required'], 422);
    }

    // Get name_id before deletion
    $stmt = db()->prepare("SELECT Name_ID FROM user_table WHERE user_id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        json_out(['error' => 'User not found'], 404);
    }

    // Delete user
    db()->prepare("DELETE FROM user_table WHERE user_id = ?")->execute([$userId]);
    
    // Delete name record (if no other users reference it)
    db()->prepare("DELETE FROM name_table WHERE Name_id = ? AND Name_id NOT IN (SELECT Name_ID FROM user_table)")->execute([$user['Name_ID']]);

    json_out(['success' => true, 'message' => 'User deleted successfully']);
}
