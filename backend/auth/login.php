<?php

/* =============================================
   BVETTER — Login
   File: backend/auth/login.php

   POST /backend/auth/login.php
   Body: { "email": "...", "password": "..." }
   Returns: { "success": true, "token": "...", "user": { ... } }

   Blocks login if:
     - Email not found
     - Wrong password
     - Account is blocked
     - Account not yet verified by admin
   ============================================= */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once '../connection.php';

// ── Read JSON body ────────────────────────────
$body     = json_decode(file_get_contents('php://input'), true);
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

// ── Validate ──────────────────────────────────
if (!$email || !$password) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Email and password are required']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
    exit;
}

try {
    // ── Find user + join name, role, verification ─
    $stmt = db()->prepare("
        SELECT
            u.user_id,
            u.Email,
            u.Password,
            u.isBlocked,
            u.Profile_image,
            n.First_name,
            n.Last_name,
            r.Role_name,
            v.verified        -- 0 = pending, 1 = approved
        FROM user_table u
        JOIN name_table         n ON u.Name_ID      = n.Name_id
        JOIN role_table         r ON u.Role_ID      = r.Role_id
        LEFT JOIN is_verified_table v ON u.Isverfied_ID = v.Isverfied_ID
        WHERE u.Email = ?
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // ── Email not found ───────────────────────
    // Same message as wrong password — don't reveal which one failed
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
        exit;
    }

    // ── Account blocked ───────────────────────
    if ($user['isBlocked']) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Your account has been blocked. Contact the administrator.']);
        exit;
    }

    // ── Wrong password ────────────────────────
    if (!password_verify($password, $user['Password'])) {

    // count this failed attempt
    $attempts = (int)$user['login_attempts'] + 1;

    if ($attempts >= 3) {
        // auto-block the account
        db()->prepare("
            UPDATE user_table 
            SET isBlocked = 1, login_attempts = ?, last_attempt = NOW()
            WHERE user_id = ?
        ")->execute([$attempts, $user['user_id']]);

        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Your account has been blocked after 3 failed attempts. Contact the administrator.'
        ]);
    } else {
        // increment attempt counter
        db()->prepare("
            UPDATE user_table 
            SET login_attempts = ?, last_attempt = NOW()
            WHERE user_id = ?
        ")->execute([$attempts, $user['user_id']]);

        $remaining = 3 - $attempts;
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => "Invalid email or password. {$remaining} attempt(s) remaining before account is blocked."
        ]);
    }
    exit;
}

// ── Login success — reset attempt counter ──
db()->prepare("
    UPDATE user_table 
    SET login_attempts = 0, last_attempt = NULL
    WHERE user_id = ?
")->execute([$user['user_id']]);

    // ── Not yet verified by admin ─────────────
    // verified = 0 means admin hasn't approved yet
   if ($user['verified'] !== NULL ) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Your account is pending verification. Please wait for admin approval.'
    ]);
    exit;
}

    // ── All checks passed — generate token ────
    $token   = bin2hex(random_bytes(32)); // 64-char secure token
    $expires = date('Y-m-d H:i:s', strtotime('+8 hours'));

    db()->prepare("
        UPDATE user_table
        SET Token = ?, Token_expires = ?
        WHERE user_id = ?
    ")->execute([$token, $expires, $user['user_id']]);

    // ── Return success ────────────────────────
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'user_id'       => $user['user_id'],
            'first_name'    => $user['First_name'],
            'last_name'     => $user['Last_name'],
            'email'         => $user['Email'],
            'role'          => $user['Role_name'],
            'profile_image' => $user['Profile_image'],
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error. Please try again.']);
    // Uncomment to debug — remove before deploy:
    // echo json_encode(['error' => $e->getMessage()]);
}
