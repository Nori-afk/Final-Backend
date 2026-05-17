<?php
/* =============================================
   BVETTER — Appointment API
   File: backend/appointment.php

   GET    ?user_id=X          → pet owner's appointments
   GET    ?id=X               → single appointment
   GET    (no params)         → all appointments (vet/admin)
   POST                       → pet owner books new appointment
   PATCH  ?id=X               → vet updates status/details
   DELETE ?id=X               → delete appointment
   ============================================= */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once 'connection.php';

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':    handle_get();    break;
        case 'POST':   handle_post();   break;
        case 'PATCH':  handle_patch();  break;
        case 'DELETE': handle_delete(); break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

/* ── GET ─────────────────────────────────────
   Returns appointments for display.
   Pet owner gets their own. Vet/admin gets all.
   ─────────────────────────────────────────── */
function handle_get() {
    $id      = $_GET['id']      ?? null;
    $user_id = $_GET['user_id'] ?? null;

    // base query — joins pet and user/vet info
    $base = "
        SELECT
            a.appointment_ID    AS id,
            a.User_ID,
            a.User_ID_vet,
            a.Visit_Details,
            a.Status,
            a.scheduled_date,
            a.scheduled_time,
            a.created_at,
            a.notes,
            -- pet info
            p.Pet_ID,
            p.Pet_name          AS patient,
            p.Pet_type,
            p.Pet_breed,
            p.Pet_Age,
            p.pet_sex,
            -- owner info
            CONCAT(n.First_name, ' ', n.Last_name) AS owner,
            u.Email             AS owner_email,
            -- vet info
            CONCAT(vn.First_name, ' ', vn.Last_name) AS vet_name
        FROM appointment_table a
        LEFT JOIN pet_table          p  ON a.Pet_ID      = p.Pet_ID
        LEFT JOIN user_table         u  ON a.User_ID     = u.user_id
        LEFT JOIN name_table         n  ON u.Name_ID     = n.Name_id
        LEFT JOIN user_table         vu ON a.User_ID_vet = vu.user_id
        LEFT JOIN name_table         vn ON vu.Name_ID    = vn.Name_id
    ";

    if ($id) {
        // single appointment
        $stmt = db()->prepare($base . " WHERE a.appointment_ID = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Appointment not found']);
            return;
        }
        echo json_encode(['success' => true, 'appointment' => format_appointment($row)]);
        return;
    }

    if ($user_id) {
        // pet owner — own appointments only
        $stmt = db()->prepare($base . " WHERE a.User_ID = ? ORDER BY a.scheduled_date DESC, a.scheduled_time DESC");
        $stmt->execute([$user_id]);
        $rows = $stmt->fetchAll();
        echo json_encode([
            'success'      => true,
            'appointments' => array_map('format_appointment', $rows)
        ]);
        return;
    }

    // vet/admin — all appointments
    $rows = db()->query($base . " ORDER BY a.scheduled_date ASC, a.scheduled_time ASC")->fetchAll();
    echo json_encode([
        'success'      => true,
        'appointments' => array_map('format_appointment', $rows)
    ]);
}

/* ── Format appointment for frontend ─────────
   Maps DB row to what appointment.js expects:
   { id, datetime, patient, owner, service,
     status, type, vet_name, notes }
   ─────────────────────────────────────────── */
function format_appointment(array $row): array {
    // build datetime string from date + time columns
    $date = $row['scheduled_date'] ?? date('Y-m-d');
    $time = $row['scheduled_time'] ?? '09:00:00';
    $datetime = $date . 'T' . $time;

    // normalize status to what appointment.js expects
    $statusMap = [
        'pending'   => 'pending',
        'confirmed' => 'confirmed',
        'completed' => 'completed',
        'cancelled' => 'canceled',
        'canceled'  => 'canceled',
    ];
    $status = $statusMap[strtolower($row['Status'] ?? 'pending')] ?? 'pending';

    return [
        'id'         => (int)$row['id'],
        'datetime'   => $datetime,
        'patient'    => $row['patient']      ?? 'Unknown',
        'owner'      => $row['owner']        ?? 'Unknown',
        'service'    => $row['Visit_Details'] ?? 'General Visit',
        'status'     => $status,
        'type'       => $row['Pet_type']     ?? 'General',
        'vet_name'   => $row['vet_name']     ?? '—',
        'notes'      => $row['notes']        ?? '',
        'pet_id'     => $row['Pet_ID'],
        'user_id'    => $row['User_ID'],
        'pet_breed'  => $row['Pet_breed']    ?? '',
        'pet_age'    => $row['Pet_Age']      ?? '',
        'pet_sex'    => $row['pet_sex']      ?? '',
    ];
}

/* ── POST ────────────────────────────────────
   Pet owner books a new appointment.
   Body: {
     user_id, owner_name, contact, email,
     barangay, address,
     pet: { name, type, breed, age, sex, last_vacc },
     visit_type, date, time, notes
   }
   ─────────────────────────────────────────── */
function handle_post() {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) {
        http_response_code(422);
        echo json_encode(['error' => 'Invalid request body']);
        return;
    }

    $user_id    = (int)($body['user_id']    ?? 0);
    $vet_id     = !empty($body['vet_id']) ? (int)$body['vet_id'] : null;
    $visit_type = trim($body['visit_type']  ?? '');
    $date       = trim($body['date']        ?? '');
    $time       = trim($body['time']        ?? '');
    $notes      = trim($body['notes']       ?? '');
    $pet        = $body['pet']              ?? [];

    // ── Validate required fields ──────────────
    if (!$user_id)    { http_response_code(422); echo json_encode(['error' => 'user_id required']); return; }
    if (!$visit_type) { http_response_code(422); echo json_encode(['error' => 'Visit type required']); return; }
    if (!$date)       { http_response_code(422); echo json_encode(['error' => 'Date required']); return; }
    if (!$time)       { http_response_code(422); echo json_encode(['error' => 'Time required']); return; }
    if (empty($pet['name'])) { http_response_code(422); echo json_encode(['error' => 'Pet name required']); return; }

    // ── Create or find pet record ─────────────
    // check if this pet already exists for this user
    $pet_stmt = db()->prepare("
        SELECT Pet_ID FROM pet_table
        WHERE user_ID = ? AND Pet_name = ?
        LIMIT 1
    ");
    $pet_stmt->execute([$user_id, $pet['name']]);
    $existing_pet = $pet_stmt->fetch();

    if ($existing_pet) {
        $pet_id = $existing_pet['Pet_ID'];
        // update pet info in case it changed
        db()->prepare("
            UPDATE pet_table
            SET Pet_type = ?, Pet_breed = ?, Pet_Age = ?, pet_sex = ?
            WHERE Pet_ID = ?
        ")->execute([
            $pet['type']  ?? 'Unknown',
            $pet['breed'] ?? null,
            $pet['age']   ?? null,
            $pet['sex']   ?? 'Unknown',
            $pet_id
        ]);
    } else {
        // create new pet record
        $ins_pet = db()->prepare("
            INSERT INTO pet_table
                (user_ID, Pet_name, Pet_type, Pet_breed, Pet_Age, pet_sex)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $ins_pet->execute([
            $user_id,
            $pet['name'],
            $pet['type']  ?? 'Unknown',
            $pet['breed'] ?? null,
            $pet['age']   ?? null,
            $pet['sex']   ?? 'Unknown',
        ]);
        $pet_id = db()->lastInsertId();
    }

    // ── Create appointment record ─────────────
    $ins_appt = db()->prepare("
        INSERT INTO appointment_table
            (Pet_ID, User_ID, User_ID_vet, Visit_Details, scheduled_date, scheduled_time, Status, notes, created_at)
        VALUES
            (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())
    ");
    $ins_appt->execute([
        $pet_id,
        $user_id,
        $vet_id,       // ← vet assigned at booking time
        $visit_type,
        $date,
        $time,
        $notes,
    ]);
    $appt_id = db()->lastInsertId();

    // ── Generate reference number ─────────────
    $reference = 'BB-' . date('Y') . '-' . str_pad($appt_id, 4, '0', STR_PAD_LEFT);

    http_response_code(201);
    echo json_encode([
        'success'        => true,
        'appointment_id' => $appt_id,
        'reference'      => $reference,
        'message'        => 'Appointment booked successfully. Pending clinic approval.',
    ]);
}

/* ── PATCH ───────────────────────────────────
   Vet/admin updates appointment.
   Can update: Status, scheduled_date,
   scheduled_time, User_ID_vet, notes
   ─────────────────────────────────────────── */
function handle_patch() {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        http_response_code(422);
        echo json_encode(['error' => 'Appointment id required']);
        return;
    }

    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) {
        http_response_code(422);
        echo json_encode(['error' => 'Invalid body']);
        return;
    }

    $updates = [];
    $values  = [];

    // map frontend status to DB status
    $statusMap = [
        'confirmed' => 'confirmed',
        'completed' => 'completed',
        'canceled'  => 'cancelled',
        'cancelled' => 'cancelled',
        'pending'   => 'pending',
    ];

    if (isset($body['status'])) {
        $dbStatus  = $statusMap[strtolower($body['status'])] ?? 'pending';
        $updates[] = 'Status = ?';
        $values[]  = $dbStatus;
    }
    if (isset($body['scheduled_date'])) {
        $updates[] = 'scheduled_date = ?';
        $values[]  = $body['scheduled_date'];
    }
    if (isset($body['scheduled_time'])) {
        $updates[] = 'scheduled_time = ?';
        $values[]  = $body['scheduled_time'];
    }
    if (isset($body['vet_id'])) {
        $updates[] = 'User_ID_vet = ?';
        $values[]  = $body['vet_id'];
    }
    if (isset($body['notes'])) {
        $updates[] = 'notes = ?';
        $values[]  = $body['notes'];
    }
    if (isset($body['visit_details'])) {
        $updates[] = 'Visit_Details = ?';
        $values[]  = $body['visit_details'];
    }

    if (empty($updates)) {
        echo json_encode(['success' => true, 'message' => 'Nothing to update']);
        return;
    }

    $values[] = $id;
    $sql = 'UPDATE appointment_table SET ' . implode(', ', $updates) . ' WHERE appointment_ID = ?';
    db()->prepare($sql)->execute($values);

    echo json_encode(['success' => true, 'message' => 'Appointment updated']);
}

/* ── DELETE ──────────────────────────────────
   Permanently removes an appointment record.
   ─────────────────────────────────────────── */
function handle_delete() {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        http_response_code(422);
        echo json_encode(['error' => 'Appointment id required']);
        return;
    }

    $stmt = db()->prepare("SELECT appointment_ID FROM appointment_table WHERE appointment_ID = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Appointment not found']);
        return;
    }

    db()->prepare("DELETE FROM appointment_table WHERE appointment_ID = ?")->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Appointment deleted']);
}