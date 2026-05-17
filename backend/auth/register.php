<?php
// temporary debug — remove before deploy
ini_set('display_errors', 1);
error_reporting(E_ALL);
/* =============================================
   BVETTER — Register
   File: backend/auth/register.php

   POST /backend/auth/register.php
   Accepts: FormData (NOT JSON — because of file upload)

   Fields:
     first_name   — required
     last_name    — required
     email        — required
     password     — required, min 8 chars
     barangay_id  — required (ID from barangay_masterlist)
     proof        — required (file: jpg, png, pdf)

   Flow:
     1. Validate inputs
     2. Check email not already used
     3. Upload proof file to uploads/proofs/
     4. Insert into name_table
     5. Insert into address_table  (uses barangay name from masterlist)
     6. Insert into is_verified_table (verified = 0, pending)
     7. Insert into user_table
     8. Return success + reference number

   NOTE:
     User cannot login until admin sets verified = 1
     in is_verified_table for that user.
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

// ── Read FormData from $_POST ─────────────────
// NOTE: FormData is in $_POST not php://input
$first_name  = trim($_POST['first_name']  ?? '');
$last_name   = trim($_POST['last_name']   ?? '');
$middle_name = trim($_POST['middle_name'] ?? '');
$email       = trim($_POST['email']       ?? '');
$password    =      $_POST['password']    ?? '';
$barangay_id = (int)($_POST['barangay_id'] ?? 0);

// ── Validate ──────────────────────────────────
$errors = [];

if (!$first_name)  $errors[] = 'First name is required';
if (!$last_name)   $errors[] = 'Last name is required';
if (!$email)       $errors[] = 'Email is required';
if (!$password)    $errors[] = 'Password is required';
if (!$barangay_id) $errors[] = 'Barangay is required';

if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Invalid email format';
}
if ($password && strlen($password) < 8) {
    $errors[] = 'Password must be at least 8 characters';
}

// ── Validate proof file ───────────────────────
if (!isset($_FILES['proof']) || $_FILES['proof']['error'] !== 0) {
    $errors[] = 'Proof of residency is required';
}

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => implode(', ', $errors)]);
    exit;
}

// ── Validate file type ────────────────────────
$allowed_extensions = ['jpg', 'jpeg', 'png', 'pdf'];
$file_ext = strtolower(pathinfo($_FILES['proof']['name'], PATHINFO_EXTENSION));
$file_size = $_FILES['proof']['size'];
$max_size  = 5 * 1024 * 1024; 

if (!in_array($file_ext, $allowed_extensions)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'File must be JPG, PNG, or PDF']);
    exit;
}

if ($file_size > $max_size) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'File size must not exceed 5MB']);
    exit;
}

try {
    // ── Check if email already exists ─────────
    $check = db()->prepare("SELECT user_id FROM user_table WHERE Email = ?");
    $check->execute([$email]);
    if ($check->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Email is already registered']);
        exit;
    }

    // ── Get barangay name from masterlist ─────
    // We store the barangay name in address_table
    $brgy_stmt = db()->prepare("
        SELECT barangay FROM barangay_masterlist WHERE barangay_id = ?
    ");
    $brgy_stmt->execute([$barangay_id]);
    $brgy_row = $brgy_stmt->fetch();

    if (!$brgy_row) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Invalid barangay selected']);
        exit;
    }
    $barangay_name = $brgy_row['barangay'];

    // ── Upload proof file ─────────────────────
    // Saves to: BVETTER-MAIN/uploads/proofs/
    $upload_dir = __DIR__ . '/../../uploads/proofs/';

    // Create folder if it doesn't exist
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    // Generate unique filename so files don't overwrite each other
    $ext       = pathinfo($_FILES['proof']['name'], PATHINFO_EXTENSION);
    $filename  = 'proof_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
    $full_path = $upload_dir . $filename;

    // Move uploaded file from temp to our folder
    if (!move_uploaded_file($_FILES['proof']['tmp_name'], $full_path)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to upload file. Check folder permissions.']);
        exit;
    }

    // Store relative path in DB (not full server path)
    $proof_path = 'uploads/proofs/' . $filename;

    // ── Step 1: Insert into name_table ────────
    $ins_name = db()->prepare("
        INSERT INTO name_table (First_name, Last_name, Middle_name)
        VALUES (?, ?, ?)
    ");
    $ins_name->execute([
        $first_name,
        $last_name,
        $middle_name ?: null
    ]);
    $name_id = db()->lastInsertId();

    // ── Step 2: Insert into address_table ─────
    $ins_addr = db()->prepare("
        INSERT INTO address_table (barangay)
        VALUES (?)
    ");
    $ins_addr->execute([$barangay_name]);
    $address_id = db()->lastInsertId();

    // ── Step 3: Insert into is_verified_table ─
    // verified = 0 means PENDING — admin must approve
    // veried_date is NULL until admin approves
    $ins_verify = db()->prepare("
        INSERT INTO is_verified_table (isverfied_image, verified, veried_date)
        VALUES (?, 0, NULL)
    ");
    $ins_verify->execute([$proof_path]);
    $verified_id = db()->lastInsertId();

    // ── Step 4: Insert into user_table ────────
    $hashed_password = password_hash($password, PASSWORD_BCRYPT);

    $ins_user = db()->prepare("
        INSERT INTO user_table
            (Name_ID, Address_ID, Password, Email, Role_ID, Isverfied_ID)
        VALUES
            (?, ?, ?, ?, 1, ?)
    ");
    // Role_ID = 1 = regular user
    // Isverfied_ID links to the pending verification record
    $ins_user->execute([
        $name_id,
        $address_id,
        $hashed_password,
        $email,
        $verified_id
    ]);

    $user_id = db()->lastInsertId();

    // ── Generate reference number ──────────────
    // Format: ACC-2025-00042 (year + user_id padded to 5 digits)
    $reference = 'ACC-' . date('Y') . '-' . str_pad($user_id, 5, '0', STR_PAD_LEFT);

    // ── Return success ────────────────────────
    http_response_code(201);
    echo json_encode([
        'success'   => true,
        'message'   => 'Account created. Please wait for admin verification.',
        'reference' => $reference,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error. Please try again.']);
    // Uncomment below to debug — remove before deploy:
    // echo json_encode(['error' => $e->getMessage()]);
}